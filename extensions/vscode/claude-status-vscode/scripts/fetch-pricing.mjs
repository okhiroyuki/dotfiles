#!/usr/bin/env node
// Anthropicの公式Pricingページ(HTML)から単価表をスクレイピングし、
// logic.ts の PRICING と比較する。ページのDOM構造が変わると壊れる前提の非公式手段。
//
// 使い方: node scripts/fetch-pricing.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');

const PRICING_URL = 'https://docs.claude.com/en/docs/about-claude/pricing';
const TABLE_SELECTOR = 'div.overflow-x-auto.my-6.text-body > table.w-full.border-collapse';

// 表示名 -> logic.ts の PRICING キー。該当なしの行(deprecated/retired等)は無視する。
const MODEL_NAME_MAP = {
  'Claude Opus 5': 'claude-opus-5',
  'Claude Sonnet 5through August 31, 2026': 'claude-sonnet-5',
  'Claude Haiku 4.5': 'claude-haiku-4-5',
};

function parseDollarsPerMTok(text) {
  const match = text.match(/\$([\d.]+)/);
  if (!match) throw new Error(`価格の解析に失敗: "${text}"`);
  return Number(match[1]);
}

function fetchPricingTable() {
  const raw = execFileSync(
    'ax',
    [PRICING_URL, TABLE_SELECTOR, '--table', '--all', '--json'],
    { encoding: 'utf-8' },
  );
  const tables = JSON.parse(raw);
  const table = tables.find((t) => t.headers[0] === 'Model' && t.headers.includes('Output Tokens'));
  if (!table) throw new Error('単価表(Model/Output Tokens列を含むtable)が見つかりません');
  return table.rows;
}

const LOGIC_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'logic.ts',
);

function loadCurrentPricing(src) {
  const match = src.match(/export const PRICING[\s\S]*?\n};/);
  if (!match) throw new Error('logic.ts からPRICINGを抽出できません');
  // eslint的な安全性は求めず、あくまで手元確認用の雑パース。
  const entries = [...match[0].matchAll(/'([\w.-]+)':\s*\{([^}]+)\}/g)];
  const current = {};
  for (const [, key, body] of entries) {
    const num = (label) => Number(body.match(new RegExp(`${label}:\\s*([\\d.]+)`))[1]);
    current[key] = {
      input: num('input'),
      output: num('output'),
      cacheWrite: num('cacheWrite'),
      cacheRead: num('cacheRead'),
    };
  }
  return current;
}

// logic.tsの既存表記(整数は "5.0" のように小数点を付ける)に合わせる。
function formatPrice(n) {
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

function applyPricing(src, current, fetched) {
  const merged = { ...current, ...fetched };
  const lines = Object.entries(merged).map(([key, p]) => {
    return `  '${key}': { input: ${formatPrice(p.input)}, output: ${formatPrice(p.output)}, cacheWrite: ${formatPrice(p.cacheWrite)}, cacheRead: ${formatPrice(p.cacheRead)} },`;
  });
  const block = `export const PRICING: Record<string, Pricing> = {\n${lines.join('\n')}\n};`;
  return src.replace(/export const PRICING[\s\S]*?\n};/, block);
}

function main() {
  const rows = fetchPricingTable();
  const src = readFileSync(LOGIC_PATH, 'utf-8');
  const current = loadCurrentPricing(src);

  const fetched = {};
  for (const row of rows) {
    const key = MODEL_NAME_MAP[row.Model];
    if (!key) continue;
    fetched[key] = {
      input: parseDollarsPerMTok(row['Base Input Tokens']),
      output: parseDollarsPerMTok(row['Output Tokens']),
      cacheWrite: parseDollarsPerMTok(row['5m Cache Writes']),
      cacheRead: parseDollarsPerMTok(row['Cache Hits & Refreshes']),
    };
  }

  console.log('=== 取得結果 (Anthropic公式Pricingページ) ===');
  console.log(JSON.stringify(fetched, null, 2));

  console.log('\n=== logic.ts の現行値との差分 ===');
  let hasDiff = false;
  for (const key of Object.keys(fetched)) {
    const before = current[key];
    const after = fetched[key];
    if (!before) {
      console.log(`[新規] ${key}: ${JSON.stringify(after)}`);
      hasDiff = true;
      continue;
    }
    const diffFields = Object.keys(after).filter((f) => before[f] !== after[f]);
    if (diffFields.length > 0) {
      console.log(`[差分あり] ${key}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      hasDiff = true;
    }
  }
  if (!hasDiff) {
    console.log('差分なし。logic.ts は最新です。');
    return;
  }

  if (APPLY) {
    const updated = applyPricing(src, current, fetched);
    writeFileSync(LOGIC_PATH, updated);
    console.log(`\n--apply により ${LOGIC_PATH} を書き換えました。`);
  } else {
    console.log('\n--apply を付けて再実行すると logic.ts に反映します。');
  }
}

main();
