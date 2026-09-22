---
description: 設計書・ADR・手順書などの産出は tanteki、PRD は prd-writer、文単位推敲は japanese-tech-writing
---

## 文書系スキルの使い分け

- 設計書・ADR・手順書・調査報告書などの文書を新規作成するとき、または構成ごと推敲するときは `tanteki` スキルを使う（忘れがちなので明示的に読み込む）
- PRD（プロダクト要求文書）は `prd-writer` 専任。tanteki を PRD に使わない
- 文単位・段落単位・表層の推敲は `japanese-tech-writing`。tanteki を使わない
- wiki（llm-wiki）内の ADR ページは `llm-wiki` の管轄。tanteki は独立した設計文書に使う

## textlint の役割分担

- opencode プラグインの textlint（ai-writing 系プリセット）: ファイル編集時に自動で適用される
- tanteki 同梱の lint: 文書を書き上げるときに自分で通す合格条件。コマンドは次のとおり
  `node ~/.claude/skills/tanteki/scripts/lint.mjs --type <文書種別> <成果物の絶対パス>`
- 両者の指摘が矛盾した場合は、ユーザーに確認する。確認できないときは、その文書を産出したときの合格条件（tanteki の lint）を優先する
