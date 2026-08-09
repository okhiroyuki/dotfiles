# chrome-extensions

dotfiles 管理下に置く、自作 Chrome 拡張機能のソース置き場です。

`tools/` や `vscode-extensions/` とは別カテゴリとして分けています。配布形式が
「パッケージ化されていない拡張機能」としてのディレクトリ読み込み（またはビルド後の `.zip`/`.crx`）、
インストール先が `chrome://extensions` という別の作法のため、一目で「Chrome拡張である」と分かるように
独立させています。

`rcup` の symlink 対象外(`rcrc` の `EXCLUDES` に `chrome-extensions/*` を指定)のため、ここに置いた拡張は
シンボリックリンクではなく、`chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」で
個別に読み込んで使います。更新時は拡張の再読み込みが必要です（詳細は各拡張の README を参照）。

## 拡張一覧

| 拡張                                                  | 役割                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| [`github-html-viewer`](github-html-viewer/README.md) | GitHub上のHTMLファイルをレンダリングして別タブで表示するボタンを追加 |

## 新しい拡張を追加する場合

1. `chrome-extensions/<name>/` にソースを配置する
2. `chrome-extensions/<name>/README.md` にセットアップ・インストール手順を書く
3. このファイルの拡張一覧に追記する
