# claude-status-vscode

Claude Codeの `statusLine` が出しているセッション情報（コスト・コンテキスト使用率・モデル名など）を、VSCodeのステータスバーにも表示する個人用のVSCode拡張機能。

## 仕組み

2つのデータソースを併用し、更新時刻が新しい方をステータスバーに表示する。

### ソース1: statusLine中継（正確なコストが分かる、対話的ターミナルのみ）

Claude Codeの `statusLine` はターミナル専用の機能で、ツール呼び出しのたびにJSONペイロードをコマンドの標準入力に流し込む（push型）。この拡張単体ではそのJSONを直接受け取れないため、dotfiles側の中継スクリプトが必要。

```
Claude Codeがツールを呼ぶ（対話的ターミナルセッションのみ）
  → ~/dotfiles/scripts/claude-status-relay.sh が起動
    → JSONを ~/.cache/claude-status/latest.json に書き出す
    → 同じJSONを本来の claude-status に渡し、ターミナル表示は従来通り維持
  → この拡張が ~/.cache/claude-status/ を fs.watch で監視
```

`statusLine` はTUIレンダリングの一部として動くため、`claude -p` のようなヘッドレスモードや、VSCode拡張パネル（Claude Code for VSCode。内部で `--output-format stream-json` のヘッドレスモードで動作する）では発火しない。そのため、VSCode拡張パネルで会話しているだけではこのソースは更新されない。

### ソース2: transcriptファイル監視（VSCode拡張パネルでも動く、コストは概算値）

VSCode拡張パネルでの会話も含め、Claude Codeの全セッションは `~/.claude/projects/<workspaceパスの/を-に置換したもの>/<session-id>.jsonl` に逐次書き込まれる。この拡張は該当ディレクトリ内の最新更新ファイルを `fs.watch` し、末尾から最後のassistantメッセージの `usage`（トークン数）を読み取ってコンテキスト使用率と、モデルごとの単価表（コード内 `PRICING` 定数）を掛け合わせた概算コストを表示する。

このソースにはAPIから返るコスト情報（USD）が含まれないため、`usage`（input/output/cache read/cache write）を単価表と掛け算して概算している。値はあくまで直近1ターン分の目安であり、セッション累計コストではない。正確な累計コストは `/usage` コマンドで確認する。

いずれのソースも更新はイベント駆動（ツール呼び出し・メッセージ確定のタイミング）で、ポーリングでの定期更新はしない。

## セットアップ

1. dotfiles側で `host-private/claude/settings.json` の `statusLine.command` が `~/dotfiles/scripts/claude-status-relay.sh` を指していることを確認する（`rcup -B private` 済みなら反映済み）
2. この拡張を有効化する（下記のいずれか）

### 動作確認（Extension Development Host）

```sh
cd ~/dotfiles/vscode-extensions/claude-status-vscode
code .
```

VSCodeが開いたら `F5`（Run > Start Debugging）で拡張開発ホストを起動する。新しいVSCodeウィンドウが立ち上がるので、そのウィンドウでフォルダを開いた状態でターミナル（VSCode内蔵でも外部WezTermでも可）から `claude` を起動し、何かツールを1回使わせる。ステータスバー左側に `$(hubot) <model> · $x.xx · yy%` が表示されれば成功。

`matchWorkspaceOnly`（デフォルトtrue）が有効なので、payload の `workspace.current_dir` が拡張開発ホストで開いているワークスペースフォルダと一致しないと表示されない（ソース1のみに影響。ソース2は開いているワークスペースフォルダのtranscriptを直接読むため常に一致する）。試す時は、実際にClaude Codeを動かしているディレクトリを開いた状態でテストすること。

VSCode拡張パネル（Claude Code for VSCode）で会話するだけでも、ソース2により `$(hubot) <model> · ~yy% · ~$x.xxxx` の形式で表示されることを確認できる。

### 常用インストール（VSIX化）

```sh
cd ~/dotfiles/vscode-extensions/claude-status-vscode
npx @vscode/vsce package --no-dependencies
code --install-extension claude-status-vscode-<version>.vsix
```

## 設定

| 設定キー                          | デフォルト                           | 説明                                                                         |
| --------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `claudeStatus.cacheFile`          | `~/.cache/claude-status/latest.json` | 中継スクリプトが書き出すキャッシュファイルのパス                             |
| `claudeStatus.matchWorkspaceOnly` | `true`                               | payloadの`workspace.current_dir`が現在のワークスペースと一致する場合のみ表示 |
