---
description: claude/rules配下のグローバルルール執筆時の規約
---

## グローバルルール（claude/rules/）執筆時の規約

- `claude/rules/` 配下のルールは全プロジェクト共通で読み込まれるため、dotfilesリポジトリ固有の概念（host-work / host-private など）を直接書かない
  - グローバル設定への言及が必要な場合は `claude/rules/claude-config-sync.md` に従う旨を書けばよい
  - work/private の詳細な使い分けは `.claude/rules/claude-settings.md` 側に閉じる
