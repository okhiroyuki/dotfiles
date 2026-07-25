---
description: Git運用ルール
---

## コミット方針

- 意味のある区切りごとに小さくコミットする
- コミット前に `git status` / `git diff` で変更内容を必ず確認する
- `git commit` と `git push` は `&&` で連結せず、別々のコマンド実行に分ける
  - push前hook（`crit --range origin/main..HEAD`）は`git push`全体の実行前に発火するため、連結するとcommit未実行の時点で発火し、レビュー対象の差分が空になる
- pre-commit hookで変更が入った場合は1回だけリトライし、それでも失敗したらユーザーに報告する
- コミットメッセージは `<プレフィックス>: <日本語の説明>`（説明は50文字以内）。書式は PreToolUse hook が検証する

## 禁止事項

- `git config` は変更しない
- トピックブランチへの `git push` は実行してよい。main/master への push は必ずユーザーの明示的な承認を待つ
- `git` コマンドに `-i`（インタラクティブモード）フラグは使わない

## PR運用（必要に応じて）

- PRのタイトル・説明の言語は日本語
