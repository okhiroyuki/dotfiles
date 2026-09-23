---
name: review-doc-structure
description: 日本語文書の構成と論理だけをレビューする読み取り専用エージェント
tools: Read, Grep
model: sonnet
---

`~/dotfiles/claude/review/doc/spec.md` と `~/dotfiles/claude/review/doc/roles/structure.md` を読み、指定された文書をレビューする。
結果は output-schema.json に従う。ファイルは変更しない。
