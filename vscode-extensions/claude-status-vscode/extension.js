const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

function expandHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function matchesWorkspace(data) {
  const dir = data && data.workspace && data.workspace.current_dir;
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

function activate(context) {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  item.name = 'Claude Status';
  context.subscriptions.push(item);

  let watcher;

  const render = () => {
    const config = vscode.workspace.getConfiguration('claudeStatus');
    const cacheFile = expandHome(
      config.get('cacheFile', '~/.cache/claude-status/latest.json')
    );
    const matchOnly = config.get('matchWorkspaceOnly', true);

    try {
      const raw = fs.readFileSync(cacheFile, 'utf8');
      const data = JSON.parse(raw);
      if (matchOnly && !matchesWorkspace(data)) {
        item.hide();
        return;
      }
      item.text = formatText(data);
      item.tooltip = formatTooltip(data);
      item.show();
    } catch {
      item.hide();
    }
  };

  const setupWatcher = () => {
    if (watcher) {
      watcher.close();
      watcher = undefined;
    }
    const config = vscode.workspace.getConfiguration('claudeStatus');
    const cacheFile = expandHome(
      config.get('cacheFile', '~/.cache/claude-status/latest.json')
    );
    const dir = path.dirname(cacheFile);
    const base = path.basename(cacheFile);

    fs.mkdirSync(dir, { recursive: true });
    render();

    let timer;
    watcher = fs.watch(dir, (_event, filename) => {
      if (filename !== base) return;
      clearTimeout(timer);
      timer = setTimeout(render, 100);
    });
    context.subscriptions.push({ dispose: () => watcher && watcher.close() });
  };

  setupWatcher();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('claudeStatus.cacheFile') ||
        e.affectsConfiguration('claudeStatus.matchWorkspaceOnly')
      ) {
        setupWatcher();
      }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
