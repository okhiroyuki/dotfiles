---
description: Auto Memory から CLAUDE.md / rules / スキルへの昇格判断基準
globs: .claude/skills/**/*, .claude/rules/**/*, .claude/CLAUDE.md, ~/.claude/projects/*/memory/**
---

# Auto Memory 昇格ルール

Auto Memory から整理された内容をもとに、条件を満たしたら
昇格をユーザーに提案する。
**ユーザーの承認なしに変更しないこと。**

## ルールへの昇格（.claude/rules/ または CLAUDE.md）

### 昇格基準

以下をすべて満たす場合に提案：

- 同じパターンが **3回以上** Auto Memory に出現
- 一般常識・一度限りの状況・Confidence: low は除外
- 全セッションで持つべき事実・規約として書く価値がある

### 昇格先の使い分け

- **CLAUDE.md** → 全セッション必須の事実（build/test コマンド、規約、構造）
- **`.claude/rules/<topic>.md`** → 特定トピック・特定パスだけ効く規約

**注意: CLAUDE.md は1ファイル200行以内が公式推奨。
肥大化したら rules/ へ分割する。**
（200行を超えると context 消費増・遵守率低下）

## スキルへの昇格（.claude/skills/<name>/SKILL.md）

### 昇格基準

詳細は `skill-management.md` の「1. スキルを作るべきかの判断」参照。

## 昇格の処理フロー

1. Auto Memory から昇格候補を抽出
2. 対象ファイル・変更内容・理由（証拠付き）を提示
3. **ユーザーの承認を待つ**
4. 承認されたら対象ファイルを編集
5. Auto Memory から該当エントリを削除:
   - `MEMORY.md` のインデックス行を削除
   - **関連トピックファイルの該当箇所も削除**
   - トピックファイルが空になったらファイルごと削除
6. Git commit を提案
   - `settings.local.json` は gitignore 対象なので commit しない

## 昇格しないもの

- 一般的なプログラミング常識
- 一度限りの状況
- Confidence: low で3ヶ月以上変化なし
- すでに allow/ask/deny に存在するコマンド
- CLAUDE.md が200行に近い場合は rules/ への分割を先に検討
