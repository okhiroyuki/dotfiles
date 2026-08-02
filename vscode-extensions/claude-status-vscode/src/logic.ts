import * as fs from 'fs';
import * as path from 'path';

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface Pricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface TranscriptEntry {
  full: string;
  mtimeMs: number;
}

export interface ParsedUsage {
  usage: Usage;
  model: string | undefined;
}

export interface UsageStats {
  total: number;
  windowSize: number;
  pct: number;
  cost: number | null;
}

// 表示用の概算値。実際の値はモデルにより変動しうるため、あくまで目安。
export const CONTEXT_WINDOW_SIZES: Record<string, number> = {
  'claude-opus-5': 1000000,
  'claude-sonnet-5': 1000000,
  'claude-haiku-4-5': 200000,
  default: 200000,
};

// $/MTok。cache writeは5分TTL(1.25倍)を採用。実際の値はモデルにより変動しうるため、あくまで目安。
export const PRICING: Record<string, Pricing> = {
  'claude-opus-5': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-sonnet-5': { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
};

export function estimateCost(model: string | undefined, usage: Usage): number | null {
  const price = model ? PRICING[model] : undefined;
  if (!price) return null;
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  return (
    (input * price.input +
      output * price.output +
      cacheWrite * price.cacheWrite +
      cacheRead * price.cacheRead) /
    1_000_000
  );
}

// Claude Codeのプロジェクトディレクトリ名は workspace の絶対パスの `/` を `-` に
// 置き換えたもの（例: /Users/foo/bar -> -Users-foo-bar）。
export function encodeProjectDir(workspacePath: string): string {
  return workspacePath.replace(/\//g, '-');
}

export function findLatestTranscript(dir: string): TranscriptEntry | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const full = path.join(dir, f);
      return { full, mtimeMs: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files.length ? files[0] : null;
}

// jsonlの末尾だけ読み、最後のassistantメッセージのusage/modelを取り出す。
// ファイルは追記専用なので末尾数十KBで十分カバーできる想定。
export function readLastUsage(file: string): ParsedUsage | null {
  const stat = fs.statSync(file);
  const readSize = Math.min(stat.size, 64 * 1024);
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(readSize);
  fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
  fs.closeSync(fd);

  const lines = buf.toString('utf8').split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const d = JSON.parse(lines[i]);
      if (d.type === 'assistant' && d.message && d.message.usage) {
        return { usage: d.message.usage, model: d.message.model };
      }
    } catch {
      // 末尾の行が書き込み途中で壊れている場合はスキップ
    }
  }
  return null;
}

export function computeUsageStats(model: string | undefined, usage: Usage): UsageStats {
  const total =
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0);
  const windowSize = (model && CONTEXT_WINDOW_SIZES[model]) || CONTEXT_WINDOW_SIZES.default;
  const pct = Math.floor((total / windowSize) * 100);
  const cost = estimateCost(model, usage);
  return { total, windowSize, pct, cost };
}

export function formatTranscriptText(model: string | undefined, usage: Usage): string {
  const { pct, cost } = computeUsageStats(model, usage);
  const costText = cost === null ? '' : ` · ~$${cost.toFixed(4)}`;
  return `$(hubot) ${model || '?'} · ~${pct}%${costText}`;
}

export function formatTooltipLines(model: string | undefined, usage: Usage): string[] {
  const { total, windowSize, pct, cost } = computeUsageStats(model, usage);
  const costLine =
    cost === null
      ? '- コスト: このモデルの単価が未登録のため算出できません'
      : `- コスト(直近ターン概算): ~$${cost.toFixed(4)}`;
  return [
    `**Claude Code session (transcript由来・概算)**`,
    `- Model: ${model || '?'}`,
    `- Context used: ~${pct}% (${total.toLocaleString()} / ${windowSize.toLocaleString()} tokens)`,
    `- Output tokens (last turn): ${usage.output_tokens || 0}`,
    costLine,
    `- キャッシュ書き込みは5分TTL単価で概算。セッション累計コストではなく直近ターンのusageのみ`,
  ];
}
