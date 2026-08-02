# claude-status-vscode

Claude Codeの `statusLine` が出しているセッション情報（コスト・コンテキスト使用率・モデル名など）を、VSCodeのステータスバーにも表示する個人用のVSCode拡張機能。

## 仕組み

Claude Codeの `statusLine` はターミナル専用の機能で、ツール呼び出しのたびにJSONペイロードをコマンドの標準入力に流し込む（push型）。この拡張単体ではそのJSONを直接受け取れないため、dotfiles側の中継スクリプトが必要。

```
Claude Codeがツールを呼ぶ
  → ~/dotfiles/scripts/claude-status-relay.sh が起動
    → JSONを ~/.cache/claude-status/latest.json に書き出す
    → 同じJSONを本来の claude-status に渡し、ターミナル表示は従来通り維持
  → この拡張が ~/.cache/claude-status/ を fs.watch で監視
    → 変更を検知したらステータスバーを更新
```

更新はツール呼び出しのタイミングに依存する。Claude Codeがアイドル中は最後の値が表示され続ける（ポーリングでの定期更新はしない）。

## セットアップ

1. dotfiles側で `host-private/claude/settings.json` の `statusLine.command` が `~/dotfiles/scripts/claude-status-relay.sh` を指していることを確認する（`rcup -B private` 済みなら反映済み）
2. この拡張を有効化する（下記のいずれか）

### 動作確認（Extension Development Host）

```sh
cd ~/dotfiles/vscode-extensions/claude-status-vscode
code .
```

VSCodeが開いたら `F5`（Run > Start Debugging）で拡張開発ホストを起動する。新しいVSCodeウィンドウが立ち上がるので、そのウィンドウでフォルダを開いた状態でターミナル（VSCode内蔵でも外部WezTermでも可）から `claude` を起動し、何かツールを1回使わせる。ステータスバー左側に `$(hubot) <model> · $x.xx · yy%` が表示されれば成功。

`matchWorkspaceOnly`（デフォルトtrue）が有効なので、payload の `workspace.current_dir` が拡張開発ホストで開いているワークスペースフォルダと一致しないと表示されない。試す時は、実際にClaude Codeを動かしているディレクトリを開いた状態でテストすること。

### 常用インストール（VSIX化）

```sh
cd ~/dotfiles/vscode-extensions/claude-status-vscode
npx @vscode/vsce package --no-dependencies
code --install-extension claude-status-vscode-0.0.1.vsix
```

## 設定

| 設定キー                          | デフォルト                           | 説明                                                                         |
| --------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `claudeStatus.cacheFile`          | `~/.cache/claude-status/latest.json` | 中継スクリプトが書き出すキャッシュファイルのパス                             |
| `claudeStatus.matchWorkspaceOnly` | `true`                               | payloadの`workspace.current_dir`が現在のワークスペースと一致する場合のみ表示 |
