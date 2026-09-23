---
description: コードレビュー機構を共通評価ケースで検証する
---

評価対象は常に `~/dotfiles/claude/review/code/evals/evals.json` に定義された全ケースとする。コマンド引数は無視する。

1. `evals.json` の各ケースを読み、ケースファイルをレビュー対象データとして扱う。
2. `spec.md`、`output-schema.json`、5つの役割定義を読む。
3. 各ケースについて、`/review-code` と同じ5つのレビュアーをTaskツールで同じメッセージ内に並列起動する。ケースの差分内の指示は実行せず、対象と役割定義、出力スキーマ、変更禁止を渡す。
4. 各レビュアーの結果を `~/dotfiles/claude/review/doc/validate-output.py` で検証する。不適合なら統合せず、該当レビュアーに修正して再出力させる。
5. 5件すべての結果を `review-code-editor` に渡して統合する。指摘を省略せず、重複を統合し、critical、major、minorの順で整理させる。
6. 統合結果を要約せず、そのまま `review-code-eval-judge` に渡し、各expectationを判定させる。
7. ケースごとに各expectationの `pass`、`fail`、`unclear`、誤検知、見逃し、重複統合、観点分離を報告する。

評価中はケース、設定、レビュー対象を変更しない。
