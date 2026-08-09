# tools

dotfiles 管理下に置く、自作の CLI ツール・エディタ/ブラウザ拡張機能のソース置き場です。

`rcup` の symlink 対象外(`rcrc` の `EXCLUDES` に `tools/*` を指定)のため、ここに置いたものは
シンボリックリンクではなく、それぞれの作法で個別にビルド・インストールして使います。

インストール作法の違いにより、2階層に分けています。

## CLIツール（`cli/`）

各ディレクトリ内で個別にビルド・グローバルインストールして使います。

| ツール                               | 役割                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ |
| [`scapple`](cli/scapple/README.md)   | Scapple の `.scap` ファイルを構造化 JSON に変換する CLI                  |
| [`llm-wiki`](cli/llm-wiki/README.md) | LLM-wiki（`~/Documents/llm-wiki`）の配管 CLI。蓄積・検索・再インデックス |

### 新しいCLIツールを追加する場合

1. `tools/cli/<name>/` にソースを配置する
2. `tools/cli/<name>/README.md` にセットアップ・使い方を書く
3. 上のツール一覧に追記する

## エディタ/ブラウザ拡張（`extensions/`）

ホストアプリ（VSCode・Chrome）独自の拡張機構でインストールします。更新時も再インストールが
必要です（詳細は各拡張の README を参照）。ホストアプリごとに配布形式・インストール先が異なるため、
`tools/extensions/<host>/<name>/` の2階層で管理しています。

### VSCode拡張（`extensions/vscode/`）

`.vsix` にパッケージ化し、`~/.vscode/extensions/` にインストールします。

| 拡張                                                                       | 役割                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`claude-status-vscode`](extensions/vscode/claude-status-vscode/README.md) | Claude Codeのセッション情報（コスト・コンテキスト使用率）をVSCodeステータスバーに表示 |

### Chrome拡張（`extensions/chrome/`）

`chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」で読み込みます。

| 拡張                                                                   | 役割                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`github-html-viewer`](extensions/chrome/github-html-viewer/README.md) | GitHub上のHTMLファイルをレンダリングして別タブで表示するボタンを追加 |

### 新しい拡張を追加する場合

1. `tools/extensions/<host>/<name>/` にソースを配置する（`<host>` は `vscode` / `chrome` など）
2. `tools/extensions/<host>/<name>/README.md` にセットアップ・インストール手順を書く
3. 上の該当ホストの拡張一覧に追記する
