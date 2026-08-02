import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  encodeProjectDir,
  findLatestTranscript,
  readLastUsage,
  formatTranscriptText,
  formatTooltipLines,
} from './logic';

interface TranscriptSource {
  mtimeMs: number;
  text: string;
  tooltip: vscode.MarkdownString;
}

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.name = 'Claude Status';
  context.subscriptions.push(item);

  let transcriptWatcher: fs.FSWatcher | undefined;

  const readTranscriptSource = (): TranscriptSource | null => {
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
      tooltip: new vscode.MarkdownString(formatTooltipLines(parsed.model, parsed.usage).join('\n')),
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

    let timer: ReturnType<typeof setTimeout>;
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

export function deactivate(): void {}
