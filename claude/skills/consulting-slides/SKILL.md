---
name: consulting-slides
description: Generates a self-contained, static HTML consulting-style slide deck (no JS framework, no reveal.js) from an outline, document, or topic the user provides — white background with a blue accent, a table of contents, and a 100-120 character message line summarizing each slide's body, following MBB/BIG4-style deck conventions. Trigger when the user asks for a consulting deck, business proposal slides, or an HTML slide deck without needing presenter-mode navigation. Does not apply to reveal.js/presentation-software slide decks with live navigation, or to generating PowerPoint/Keynote/Google Slides files.
model: opus
---

# consulting-slides — コンサル資料スタイルのHTML静的スライド生成

白地に青系アクセントの静的HTMLスライドを、MBB/BIG4系の資料作法で生成する。プレゼンター操作は持たず、16:9スライドを縦に並べた1ファイルとし、ブラウザの印刷機能でPDF化する運用を前提とする。

## 生成手順

1. **Text First**: レイアウトより先に、全スライドのh2(体言止め)とmessage-line(結論1文)をテキストだけで確定する
2. `assets/template.html` をベースに、`assets/theme.css` の中身を `<style>` として埋め込んだ**単一HTMLファイル**を作る(別ファイルのtheme.cssは配置しない)
3. 構成は 表紙(`cover`) → 目次(`toc-list`) → コンテンツスライド の順
4. 各コンテンツスライド: h2(体言止め、最上部) → message-line(**100〜120字**、常体、作成後に文字数を実測) → 本文。Body領域は上下まんべんなく埋め、上半分だけで下半分が空白の状態にしない
5. 主要論点は1スライド3〜5個まで。フォントを縮めて詰め込まず、収まらなければスライドを分割する
6. 表は `block-table`(`<table>`不可)、矢印は `arrow-right`(テキスト矢印不可)、強調は `panel` を使う
7. フッター・絵文字・box-shadow・グラデーション・角丸・タイトル直下の水平線は使わない
8. 色は `theme.css` の `:root` 変数のみを使い、スライド個別に上書きしない
9. 生成前に保存先(ディレクトリ・ファイル名)をユーザーに提案し、確認を得てから書き出す
10. 生成後、`open <path>`(macOS)でブラウザに開き、ユーザーがすぐ見られる状態にする。表示崩れがないかも確認する。Artifact公開など外部共有はユーザーの明示的な依頼がない限り行わない

## 情報構造ごとの表現パターン

迷ったときの初期候補として使う。

| 伝えたい構造          | 使うコンポーネント                |
| --------------------- | --------------------------------- |
| 数値・項目の比較      | `block-table`                     |
| 時系列・因果関係      | `panel` を `arrow-right` でつなぐ |
| 対比(現状/あるべき姿) | `display:flex` の2カラム          |
| 強調したい結論・数値  | `panel`                           |
| 単純な列挙            | 箇条書き(3〜5個)                  |

## カラーパレット

| 用途                             | 変数          | 色コード  |
| -------------------------------- | ------------- | --------- |
| 背景                             | `--bg`        | `#ffffff` |
| アクセント青(見出しには使わない) | `--accent`    | `#1c6fb4` |
| 見出し・本文                     | `--ink`       | `#1a1a1a` |
| ミュートテキスト                 | `--muted`     | `#758696` |
| 強調パネル背景                   | `--panel-bg`  | `#dde6f0` |
| 罫線                             | `--rule`      | `#e2e2e2` |
| block-tableラベル列背景          | `--header-bg` | `#595959` |

## 成功基準

- 表紙→目次→コンテンツの順序、各スライドがh2→message-line→本文の構造になっている
- message-lineが100〜120字・常体・体言止めでない
- フッター・絵文字・box-shadow・グラデーション・角丸・テキスト矢印・`<table>`を使っていない
- 主要論点が3〜5個以内、Body領域が上下バランスよく埋まっている
- CSS埋め込みの単一HTMLファイルになっており、保存先をユーザーに提案・確認してから書き出した
- 生成後にブラウザで自動的に開き、表示崩れがないか確認した。ユーザーの明示的な依頼なしにArtifact等へ公開していない
