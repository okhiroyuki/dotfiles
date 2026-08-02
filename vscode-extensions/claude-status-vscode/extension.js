const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 表示用の概算値。実際の値はモデルにより変動しうるため、あくまで目安。
const CONTEXT_WINDOW_SIZES = {
  'claude-opus-5': 1000000,
  'claude-sonnet-5': 1000000,
  'claude-haiku-4-5': 200000,
  default: 200000,
};

// $/MTok。cache writeは5分TTL(1.25倍)を採用。実際の値はモデルにより変動しうるため、あくまで目安。
const PRICING = {
  'claude-opus-5': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-sonnet-5': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
};

function estimateCost(model, usage) {
  const price = PRICING[model];
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
function encodeProjectDir(workspacePath) {
  return workspacePath.replace(/\//g, '-');
}

function findLatestTranscript(dir) {
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
function readLastUsage(file) {
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

function formatTranscriptText(model, usage) {
  const total =
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0);
  const windowSize = CONTEXT_WINDOW_SIZES[model] || CONTEXT_WINDOW_SIZES.default;
  const pct = Math.floor((total / windowSize) * 100);
  const cost = estimateCost(model, usage);
  const costText = cost === null ? '' : ` · ~$${cost.toFixed(4)}`;
  return `$(hubot) ${model || '?'} · ~${pct}%${costText}`;
}

function formatTranscriptTooltip(model, usage) {
  const total =
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0);
  const windowSize = CONTEXT_WINDOW_SIZES[model] || CONTEXT_WINDOW_SIZES.default;
  const pct = Math.floor((total / windowSize) * 100);
  const cost = estimateCost(model, usage);
  const costLine =
    cost === null
      ? '- コスト: このモデルの単価が未登録のため算出できません'
      : `- コスト(直近ターン概算): ~$${cost.toFixed(4)}`;
  return new vscode.MarkdownString(
    [
      `**Claude Code session (transcript由来・概算)**`,
      `- Model: ${model || '?'}`,
      `- Context used: ~${pct}% (${total.toLocaleString()} / ${windowSize.toLocaleString()} tokens)`,
      `- Output tokens (last turn): ${usage.output_tokens || 0}`,
      costLine,
      `- キャッシュ書き込みは5分TTL単価で概算。セッション累計コストではなく直近ターンのusageのみ`,
    ].join('\n')
  );
}

function activate(context) {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  item.name = 'Claude Status';
  context.subscriptions.push(item);

  let transcriptWatcher;

  const readTranscriptSource = () => {
    const folders = vscode.workspace.workspaceFolders || [];
    if (!folders.length) return null;
    const projectDir = path.join(
      os.homedir(),
      '.claude',
      'projects',
      encodeProjectDir(folders[0].uri.fsPath)
    );
    const latest = findLatestTranscript(projectDir);
    if (!latest) return null;
    const parsed = readLastUsage(latest.full);
    if (!parsed) return null;
    return {
      mtimeMs: latest.mtimeMs,
      text: formatTranscriptText(parsed.model, parsed.usage),
      tooltip: formatTranscriptTooltip(parsed.model, parsed.usage),
    };
  };

  const render = () => {
    const transcript = readTranscriptSource();

    if (!transcript) {
      item.hide();
      return;
    }
    item.text = transcript.text;
    item.tooltip = transcript.tooltip;
    item.show();
  };

  const setupWatchers = () => {
    if (transcriptWatcher) {
      transcriptWatcher.close();
      transcriptWatcher = undefined;
    }

    render();

    let timer;
    const scheduleRender = () => {
      clearTimeout(timer);
      timer = setTimeout(render, 100);
    };

    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length) {
      const projectDir = path.join(
        os.homedir(),
        '.claude',
        'projects',
        encodeProjectDir(folders[0].uri.fsPath)
      );
      if (fs.existsSync(projectDir)) {
        transcriptWatcher = fs.watch(projectDir, (_event, filename) => {
          if (filename && !filename.endsWith('.jsonl')) return;
          scheduleRender();
        });
        context.subscriptions.push({
          dispose: () => transcriptWatcher && transcriptWatcher.close(),
        });
      }
    }
  };

  setupWatchers();

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => setupWatchers())
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
