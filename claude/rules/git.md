---
description: Git運用ルール
---

## コミット方針

- 意味のある区切りごとに小さくコミットする
- コミットメッセージの書式・品質は `commit-message.md` に従う
- 変更がない場合は空コミットを作らない
- コミット前に `git status` / `git diff` で変更内容を必ず確認する
- `git commit` と `git push` は `&&` で連結せず、別々のコマンド実行に分ける
  - push前hook（`crit --range origin/main..HEAD`）は`git push`コマンド全体の実行前に発火するため、連結すると発火時点でcommitが未実行になり、レビュー対象の差分が空になる

## ブランチ操作

- ブランチの切り替えには `git switch` を使う（`git checkout` は使わない）
- 新規ブランチ作成は `git switch -c ブランチ名`

## 禁止事項

- `git config` は変更しない
- `git push` はユーザーが明示的に指示した場合のみ実行する
- `git` コマンドに `-i`（インタラクティブモード）フラグは使わない
- `git -C <path>` は使わない（`cd` の前置と同様、権限プロンプトのパターンマッチが崩れるため。既にカレントディレクトリはリポジトリ内にあるので不要）
- pre-commit hookで変更が入った場合は1回だけリトライし、それでも失敗した場合はユーザーに報告する

## AI署名

- コミットメッセージに `🤖 Generated with Claude Code` や `Co-Authored-By: Claude` は付与しない

## PR運用（必要に応じて）

- PRのタイトル・説明の言語は日本語
- PR作成前に `git log` でコミット履歴を確認する
