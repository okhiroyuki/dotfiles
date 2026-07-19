---
name: japanese-tech-writing
description: 日本語の技術文書・書籍原稿の文章規範。整形（一文一行、引用ブロック、脚注、コラム記法）、段落と論証の構成（パラグラフライティング）、論証の厳密さ（ツッコミどころの除去）、読み手の負荷の管理、視点と語り、演出の抑制、LLM っぽい空句の禁止、冗長の排除を定める。日本語で技術書の章、草稿、記事、解説文を書くとき、または推敲・リライトするときに使用する。コードコメントや短いチャット返答、ドキュメント全体の情報構造（それは cognitive-load-docs スキルの対象）には使わない。
model: opus
---

# 日本語技術文書の文章規範

日本語で技術的な原稿（書籍の章、記事、解説文）を書く・推敲するときは、以下の規範に従う。
対象は文単位・段落単位の文章表現であり、ドキュメント全体の構造設計は cognitive-load-docs スキルに委ねる。

規範は4つの参照ファイルに分かれている。書く・推敲するときは該当するものを読む。迷ったら全部読む。

- **[formatting-and-headings.md](references/formatting-and-headings.md)** — 整形（改行・脚注・太字・ダッシュ・中黒）、見出しの付け方
- **[argumentation.md](references/argumentation.md)** — 段落と論証の構成（パラグラフライティング）、論証の厳密さ（ツッコミどころの除去）
- **[voice-and-restraint.md](references/voice-and-restraint.md)** — 視点と語り、演出の抑制、LLM っぽい表現の禁止
- **[reader-and-integrity.md](references/reader-and-integrity.md)** — 読み手の負荷の管理、冗長の排除、読者への誠実さ

## 成功基準

書き上げた・推敲した原稿を提示する前に、4ファイルの規範に照らして自己点検する。

- [ ] 整形（改行・太字の使い分け・ダッシュ/中黒の不使用）が formatting-and-headings.md に従っている
- [ ] 各段落が一つのトピックに絞られ、論証が一方向に進んでいる（argumentation.md）
- [ ] 断定・推量の使い分けが本文の根拠と整合し、ツッコミどころが残っていない（argumentation.md）
- [ ] LLM っぽい空句（予告と総括、正面から系、空虚な形容・動詞など）が残っていない（voice-and-restraint.md）
- [ ] 同じ主張の言い換え重複や、自力で補える説明の書き過ぎがない（reader-and-integrity.md）
