---
name: consulting-slides
description: Generates a self-contained, static HTML consulting-style slide deck (no JS framework, no reveal.js) from an outline, document, or topic the user provides — white background with a blue accent, a table of contents, and a 100-120 character message line summarizing each slide's body, following MBB/BIG4-style deck conventions. Trigger when the user asks for a consulting deck, business proposal slides, or an HTML slide deck without needing presenter-mode navigation. Does not apply to reveal.js/presentation-software slide decks with live navigation, or to generating PowerPoint/Keynote/Google Slides files.
model: opus
---

# consulting-slides — コンサル資料スタイルのHTML静的スライド生成

白地に青系アクセントで、MBB/BIG4系コンサルの資料作法に沿った静的HTMLスライドを生成する。プレゼンター操作(矢印キー送り等)は持たず、1つのHTMLファイルに16:9スライドを縦に並べ、ブラウザの印刷機能でPDF化する運用を前提とする。

## 生成手順

1. `assets/template.html` を出力先にコピーし、`assets/theme.css` を同じディレクトリに配置する(相対パス参照)
2. 構成は 表紙(`class="cover"`) → 目次(`h2`に「目次」、`class="toc-list"`) → 各章のコンテンツスライド、の順を守る
3. 各コンテンツスライドは `h2` タイトル(**体言止め**、スライド最上部)を先頭に置き、その直下に `message-line`(**100〜120字**、本文の要点・数値を含む要約、常体・体言止め禁止)、続けて本文を置く
4. メッセージラインは作成後に文字数を実測する。100字未満・120字超なら書き直す。短縮で20pt相当(`.message-line`のfont-size)を下げて逃げてはいけない。収まらない場合はスライドを分割する
5. フッター(ページ番号・出典などをまとめた帯)は付けない。出典・注釈が必要な場合は本文または最終スライドに統合する
6. 表は `<table>` を使わず `class="block-table"` の `row`/`cell` 構成で表現する。ヘッダー行に `class="row header"`、行間は破線(CSSで自動)、1列目は `class="cell label"` でグレー背景+白太字にする(`template.html` 参照)
7. 矢印はテキスト記号(→等)を使わず `class="arrow-right"`(CSS三角形)を使う
8. 強調・引用は `class="panel"` を使う(青枠+薄青背景)
9. 1スライドの主要論点は3〜5個までに収める。収まらない場合は列数・行数を削るかスライドを分割する。フォントサイズを下げて詰め込むことは禁止

## カラーパレット(theme.cssの`:root`変数で定義済み・SKILL側で新規に決め打ちしない)

| 用途                           | 変数          | 色コード  |
| ------------------------------ | ------------- | --------- |
| 背景(基本)                     | `--bg`        | `#ffffff` |
| アクセント青(見出しに使わない) | `--accent`    | `#1c6fb4` |
| 見出し・本文テキスト           | `--ink`       | `#1a1a1a` |
| ミュートテキスト               | `--muted`     | `#758696` |
| 強調パネル背景                 | `--panel-bg`  | `#dde6f0` |
| 罫線・区切り                   | `--rule`      | `#e2e2e2` |
| block-tableラベル列背景        | `--header-bg` | `#595959` |

色の追加・変更は `assets/theme.css` の `:root` を編集する。スライド個別のインラインスタイルで色を上書きしない。表紙以外のスライドで見出し・本文を青一色にしない(青はアクセント・目次番号・罫線・パネル枠に限定)。

## 確認方法

生成したHTMLはブラウザで直接開けば全スライドが縦に並んで表示される。PDF化する場合はブラウザの印刷(Ctrl/Cmd+P)を使う。`@page` と `.slide { page-break-after: always }` により1スライド1ページで出力される。

## 成功基準

- 表紙→目次→コンテンツの順序と、各コンテンツスライドの h2(スライド最上部)→ message-line → 本文 の構造を守っている
- メッセージラインが100〜120字、常体、体言止めでない
- フッター(ページ番号・出典などをまとめた帯)を追加していない
- 表は `<table>` ではなく `block-table` 構成になっている。矢印はCSS三角形であり `→` 等のテキスト矢印を使っていない
- 1スライドの主要論点が3〜5個以内に収まっている
- 生成後、ブラウザで開いて表示崩れがないことを確認した(確認できない場合はその旨を明示する)
