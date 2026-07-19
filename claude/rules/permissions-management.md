---
description: 確認プロンプトの蓄積に気づいたときに permission-promotion スキルを必ず使う
paths:
  - ".claude/settings.json"
  - ".claude/settings.local.json"
  - "~/.claude/settings.json"
---

確認プロンプトが繰り返し発生しても、その場での即時昇格提案はしない。
Auto Memory に蓄積された確認履歴（3回以上・非破壊・拒否なし等）が
昇格基準に達したと気づいたら、必ず `permission-promotion` スキルを起動してから
昇格の要否・対象スコープ(allow/ask/deny)を判断すること。

ユーザーの承認なしに設定ファイルを変更しないことは、このスキルの外でも常に必須。
