# vscode-extensions

dotfiles 管理下に置く、自作 VSCode 拡張機能のソース置き場です。

`tools/` とは別カテゴリとして分けています。`tools/` 配下のCLIは
「個別にビルドしてグローバルインストール」ですが、こちらは配布形式が
`.vsix`、インストール先が `~/.vscode/extensions/` という別の作法のため、
一目で「VSCode拡張である」と分かるように独立させています。

`rcup` の symlink 対象外(`rcrc` の `EXCLUDES` に `vscode-extensions/*` を指定)
のため、ここに置いた拡張はシンボリックリンクではなく、`vsce package` で
`.vsix` を作り `code --install-extension` で個別にインストールして使います。
更新時は再パッケージ・再インストールが必要です（詳細は各拡張の README を参照）。

## 拡張一覧

| 拡張                                                     | 役割                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`claude-status-vscode`](claude-status-vscode/README.md) | Claude Codeのセッション情報（コスト・コンテキスト使用率）をVSCodeステータスバーに表示 |

## 新しい拡張を追加する場合

1. `vscode-extensions/<name>/` にソースを配置する
2. `vscode-extensions/<name>/README.md` にセットアップ・インストール手順を書く
3. このファイルの拡張一覧に追記する
