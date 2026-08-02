import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  estimateCost,
  encodeProjectDir,
  findLatestTranscript,
  readLastUsage,
  computeUsageStats,
  formatTranscriptText,
  formatTooltipLines,
} from './logic.ts';

test('estimateCost: 単価未登録のモデルはnull', () => {
  assert.equal(estimateCost('unknown-model', { input_tokens: 100 }), null);
  assert.equal(estimateCost(undefined, { input_tokens: 100 }), null);
});

test('estimateCost: input/output/cache write/readを単価表通りに合算する', () => {
  const cost = estimateCost('claude-sonnet-5', {
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_creation_input_tokens: 1_000_000,
    cache_read_input_tokens: 1_000_000,
  });
  assert.equal(cost, 3.0 + 15.0 + 3.75 + 0.3);
});

test('estimateCost: usageのフィールド欠落は0として扱う', () => {
  assert.equal(estimateCost('claude-sonnet-5', {}), 0);
});

test('encodeProjectDir: 絶対パスの/を-に置換する', () => {
  assert.equal(encodeProjectDir('/Users/foo/bar'), '-Users-foo-bar');
});

test('findLatestTranscript: 存在しないディレクトリはnull', () => {
  assert.equal(findLatestTranscript('/path/does/not/exist'), null);
});

test('findLatestTranscript: 最終更新が最も新しい.jsonlを返す', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-test-'));
  try {
    const older = path.join(dir, 'a.jsonl');
    const newer = path.join(dir, 'b.jsonl');
    const ignored = path.join(dir, 'c.txt');
    fs.writeFileSync(older, '');
    fs.writeFileSync(ignored, '');
    const now = Date.now();
    fs.utimesSync(older, new Date(now - 10_000), new Date(now - 10_000));
    fs.writeFileSync(newer, '');
    fs.utimesSync(newer, new Date(now), new Date(now));

    const latest = findLatestTranscript(dir);
    assert.equal(latest?.full, newer);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readLastUsage: 末尾の最後のassistantメッセージのusage/modelを返す', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-test-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    const lines = [
      JSON.stringify({ type: 'user', message: { content: 'hi' } }),
      JSON.stringify({
        type: 'assistant',
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 10, output_tokens: 20 } },
      }),
      JSON.stringify({ type: 'user', message: { content: 'thanks' } }),
    ];
    fs.writeFileSync(file, lines.join('\n') + '\n');

    const parsed = readLastUsage(file);
    assert.deepEqual(parsed, {
      usage: { input_tokens: 10, output_tokens: 20 },
      model: 'claude-sonnet-5',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readLastUsage: 末尾が壊れたJSON行でもそれより前の行から拾う', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-test-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: { model: 'claude-haiku-4-5', usage: { input_tokens: 5 } },
      }),
      '{"type":"assistant","message":{"usage":{"input_to', // 書き込み途中で壊れた行
    ];
    fs.writeFileSync(file, lines.join('\n') + '\n');

    const parsed = readLastUsage(file);
    assert.deepEqual(parsed, {
      usage: { input_tokens: 5 },
      model: 'claude-haiku-4-5',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readLastUsage: assistantメッセージが存在しなければnull', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-test-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    fs.writeFileSync(file, JSON.stringify({ type: 'user', message: { content: 'hi' } }) + '\n');
    assert.equal(readLastUsage(file), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('computeUsageStats: コンテキスト使用率をwindowSizeに対する割合で切り捨てる', () => {
  const stats = computeUsageStats('claude-haiku-4-5', { input_tokens: 100_000 });
  assert.equal(stats.windowSize, 200_000);
  assert.equal(stats.pct, 50);
});

test('computeUsageStats: 未知モデルはdefaultのwindowSizeを使う', () => {
  const stats = computeUsageStats('unknown-model', { input_tokens: 100_000 });
  assert.equal(stats.windowSize, 200_000);
});

test('formatTranscriptText: モデル・使用率・概算コストを含む', () => {
  const text = formatTranscriptText('claude-sonnet-5', { input_tokens: 500_000 });
  assert.match(text, /^\$\(hubot\) claude-sonnet-5 · ~50% · ~\$/);
});

test('formatTranscriptText: 単価未登録モデルはコスト表記を省く', () => {
  const text = formatTranscriptText('unknown-model', { input_tokens: 100_000 });
  assert.equal(text, '$(hubot) unknown-model · ~50%');
});

test('formatTooltipLines: コスト行を含む6行を返す', () => {
  const lines = formatTooltipLines('claude-sonnet-5', { input_tokens: 100 });
  assert.equal(lines.length, 6);
  assert.match(lines[4], /^- コスト\(直近ターン概算\): ~\$/);
});

test('formatTooltipLines: 単価未登録モデルは算出不可の注記を出す', () => {
  const lines = formatTooltipLines('unknown-model', { input_tokens: 100 });
  assert.equal(lines[4], '- コスト: このモデルの単価が未登録のため算出できません');
});
