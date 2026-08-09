# claude-status-vscode

Claude Codeのセッション情報（コスト概算・コンテキスト使用率・モデル名など）を、VSCodeのステータスバーに表示する個人用のVSCode拡張機能。

## 仕組み

Claude Codeの全セッション（VSCode拡張パネルでの会話も、ターミナルからの `claude` 起動も含む）は `~/.claude/projects/<workspaceパスの/と_を-に置換したもの>/<session-id>.jsonl` に逐次書き込まれる。この拡張は該当ディレクトリ内の最新更新ファイルを `fs.watch` し、末尾から最後のassistantメッセージの `usage`（トークン数）を読み取ってコンテキスト使用率と、モデルごとの単価表（コード内 `PRICING` 定数）を掛け合わせた概算コストを表示する。

transcriptにはAPIから返るコスト情報（USD）が含まれないため、`usage`（input/output/cache read/cache write）を単価表と掛け算して概算している。値はあくまで直近1ターン分の目安であり、セッション累計コストではない。正確な累計コストは `/usage` コマンドで確認する。

更新はイベント駆動（メッセージ確定のタイミング）で、ポーリングでの定期更新はしない。

拡張本体はTypeScript（`src/extension.ts`）で記述し、`tsc` で `dist/extension.js` にコンパイルする。

## セットアップ

### 動作確認（Extension Development Host）

```sh
cd ~/dotfiles
mise run build:claude-status-vscode
code extensions/vscode/claude-status-vscode
```

VSCodeが開いたら `F5`（Run > Start Debugging）で拡張開発ホストを起動する。新しいVSCodeウィンドウが立ち上がるので、そのウィンドウでフォルダを開いた状態でターミナル（VSCode内蔵でも外部WezTermでも可）から `claude` を起動するか、VSCode拡張パネル（Claude Code for VSCode）で会話する。ステータスバー左側に `$(hubot) <model> · ~yy% · ~$x.xxxx` が表示されれば成功。

### 常用インストール（VSIX化）

```sh
cd ~/dotfiles
mise run install:claude-status-vscode
```

## 設定

現時点でユーザー設定項目はない。表示対象は常に、現在開いているワークスペースフォルダ直下のtranscriptディレクトリ（`~/.claude/projects/<encoded-workspace-path>/`）内の最新ファイル。
