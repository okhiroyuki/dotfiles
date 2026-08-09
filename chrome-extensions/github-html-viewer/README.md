# github-html-viewer

GitHub上の `.html` / `.htm` ファイルのblobページ（例:
`https://github.com/owner/repo/blob/main/index.html`）に「HTMLとして表示」ボタンを追加し、
GitHubのソースコード表示ではなく、実際にレンダリングされたHTMLを別タブで確認できるようにするChrome拡張です。

## 仕組み

1. `content-script.js` がGitHubのblobページを監視し、対象ファイルが `.html` / `.htm` なら画面右下にボタンを表示する
2. ボタンを押すと、そのファイルのraw URL（`/blob/` → `/raw/`）からHTMLを取得する
3. 相対パスのCSS/JS/画像がraw.githubusercontent.com上の元ファイルを参照できるよう `<base>` タグを埋め込む
4. 取得したHTMLを `chrome.storage.local` に一時保存し、拡張内の `viewer.html` を新しいタブで開く
5. `viewer.html` はsandbox化された `<iframe>`（`allow-same-origin` を付与しない）にHTMLを `srcdoc` として渡し、
   拡張のAPIやページのDOMにアクセスできない状態でレンダリングする

## インストール（開発者モード）

1. `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」から `chrome-extensions/github-html-viewer/` を選択する

コードを変更した場合は、`chrome://extensions` の当該拡張の再読み込みボタンを押してください。

## 制限事項

- 非公開リポジトリのファイルは、拡張を使っているブラウザでGitHubにログイン済みであれば表示できます
  （content scriptがページと同じCookieでrawエンドポイントにアクセスするため）
- リンク先が別ファイル（別ページ）への相対リンクの場合、その遷移先はレンダリングされません
  （あくまで単一HTMLファイルのプレビュー用です）

## テスト

`isHtmlBlobPage` / `toRawUrl` / `deriveFileName` / `withBaseHref` などの純粋関数は `lib/logic.js` に切り出し、
`lib/logic.test.js` でNode標準の `node:test` を使ってテストしています。

```zsh
node --test lib/*.test.js
```
