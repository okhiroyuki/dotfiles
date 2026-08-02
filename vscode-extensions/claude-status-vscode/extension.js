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

function expandHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function matchesWorkspace(dir) {
  if (!dir) return true;
  const folders = vscode.workspace.workspaceFolders || [];
  return folders.some(
    (f) => dir === f.uri.fsPath || dir.startsWith(f.uri.fsPath + path.sep)
  );
}

function formatText(data) {
  const model = (data.model && data.model.display_name) || '?';
  const cost = (data.cost && data.cost.total_cost_usd) || 0;
  const ctx = Math.floor(
    (data.context_window && data.context_window.used_percentage) || 0
  );
  return `$(hubot) ${model} · $${cost.toFixed(2)} · ${ctx}%`;
}

function formatTooltip(data) {
  const added = (data.cost && data.cost.total_lines_added) || 0;
  const removed = (data.cost && data.cost.total_lines_removed) || 0;
  const durationMs = (data.cost && data.cost.total_duration_ms) || 0;
  const mins = Math.floor(durationMs / 60000);
  const cost = (data.cost && data.cost.total_cost_usd) || 0;
  const ctx = Math.floor(
    (data.context_window && data.context_window.used_percentage) || 0
  );
  return new vscode.MarkdownString(
    [
      `**Claude Code session**`,
      `- Model: ${(data.model && data.model.display_name) || '?'}`,
      `- Cost: $${cost.toFixed(4)}`,
      `- Context used: ${ctx}%`,
      `- Duration: ${mins}m`,
      `- Diff: +${added} -${removed}`,
    ].join('\n')
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

  let cacheWatcher;
  let transcriptWatcher;

  const readCacheSource = () => {
    const config = vscode.workspace.getConfiguration('claudeStatus');
    const cacheFile = expandHome(
      config.get('cacheFile', '~/.cache/claude-status/latest.json')
    );
    try {
      const stat = fs.statSync(cacheFile);
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const dir = data && data.workspace && data.workspace.current_dir;
      const config2 = vscode.workspace.getConfiguration('claudeStatus');
      const matchOnly = config2.get('matchWorkspaceOnly', true);
      if (matchOnly && !matchesWorkspace(dir)) return null;
      return {
        mtimeMs: stat.mtimeMs,
        text: formatText(data),
        tooltip: formatTooltip(data),
      };
    } catch {
      return null;
    }
  };

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
    const cache = readCacheSource();
    const transcript = readTranscriptSource();

    const best = [cache, transcript]
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

    if (!best) {
      item.hide();
      return;
    }
    item.text = best.text;
    item.tooltip = best.tooltip;
    item.show();
  };

  const setupWatchers = () => {
    if (cacheWatcher) {
      cacheWatcher.close();
      cacheWatcher = undefined;
    }
    if (transcriptWatcher) {
      transcriptWatcher.close();
      transcriptWatcher = undefined;
    }

    const config = vscode.workspace.getConfiguration('claudeStatus');
    const cacheFile = expandHome(
      config.get('cacheFile', '~/.cache/claude-status/latest.json')
    );
    const cacheDir = path.dirname(cacheFile);
    const cacheBase = path.basename(cacheFile);
    fs.mkdirSync(cacheDir, { recursive: true });

    render();

    let timer;
    const scheduleRender = () => {
      clearTimeout(timer);
      timer = setTimeout(render, 100);
    };

    cacheWatcher = fs.watch(cacheDir, (_event, filename) => {
      if (filename !== cacheBase) return;
      scheduleRender();
    });
    context.subscriptions.push({
      dispose: () => cacheWatcher && cacheWatcher.close(),
    });

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
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('claudeStatus.cacheFile') ||
        e.affectsConfiguration('claudeStatus.matchWorkspaceOnly')
      ) {
        setupWatchers();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => setupWatchers())
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
