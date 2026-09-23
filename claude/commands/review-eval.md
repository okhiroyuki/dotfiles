---
description: 文書レビュー機構を共通評価ケースで検証する
---

評価対象は常に `~/dotfiles/claude/review/evals/evals.json` に定義された全ケースとする。コマンド引数は無視する。

1. `~/dotfiles/claude/review/evals/evals.json` を読む。
2. 各ケースの `file` を `~/dotfiles/claude/review/evals/` からの相対パスとして解決して読み、`~/dotfiles/claude/review/spec.md` と `~/dotfiles/claude/review/output-schema.json` を読む。
3. 各ケースについて、`/review` と同じ5つのレビュアーをTaskツールで同じメッセージ内に並列起動する。各Taskには対象ファイル、役割定義、出力スキーマ、変更禁止を渡す。
4. 全結果を `review-editor` に渡して統合する。統合者には、各ケースの指摘を省略せず、修正必須・改善提案・棄却した指摘の全文を出力させる。
5. 統合者の出力を要約・再編集せず、そのまま `review-eval-judge` に渡す。各ケースの `expectations` も同時に渡す。
6. 判定者には、各expectationについて対応する統合結果の `location`、`problem`、`evidence`、`suggestion` を引用させる。対応する具体的な指摘がない場合は `unclear` ではなく `fail` とし、統合結果自体が不足していて判定できない場合だけ `unclear` とする。
7. ケースごとに、各expectationを `pass`、`fail`、`unclear` のいずれかで判定し、誤検知、見逃し、重複統合の結果も報告する。

評価中はケースファイル、設定、レビュー対象を変更しない。
