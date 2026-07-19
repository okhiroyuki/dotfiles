---
description: パーミッション（allow/ask/deny）の昇格判断基準
globs: .claude/settings.json, .claude/settings.local.json, ~/.claude/settings.json
---

# パーミッション昇格ルール

Auto Memory の記録をもとに、パーミッションの昇格をユーザーに提案する。
**ユーザーの承認なしに変更しないこと。**

非破壊的なコマンドで確認プロンプトが出た場合も、その場で都度昇格提案はしない。
Auto Memory に記録を蓄積し、下記の閾値に達した時点でまとめて提案する
（プロンプト発生のたびに即時提案する方式は形骸化して機能しなかったため廃止）。

## 前提

### 設定スコープ
| スコープ | 場所 | 影響範囲 | Git 共有 |
|---|---|---|---|
| Managed | サーバー配信・plist | 組織/マシン全体 | IT 配布 |
| User | `~/.claude/settings.json` | 自分・全プロジェクト | しない |
| Project | `.claude/settings.json` | リポジトリ共同作業者 | する |
| Local | `.claude/settings.local.json` | 自分・当該リポジトリのみ | しない（自動 gitignore） |

### 評価優先順位
**deny → ask → allow の順**。最初のマッチが勝つ。
**deny は全スコープで最優先**。上位スコープの deny は
下位スコープの allow で上書きできない。
「user 設定が allow でも project 設定が deny ならブロック。
その逆も同様。」

## allow 昇格基準
以下をすべて満たす読み取り・非破壊コマンド（誤っても取り消し・やり直しが容易な操作を含む）：
- **3回以上** 確認ダイアログが出た
- **1度も拒否されたことがない**
- **副作用がない**（ファイル変更・リモート反映・公開を伴わない）
- 削除・上書き・外部送信など取り消しが困難な操作は対象外
- プロジェクト deny と競合しない
- **上位スコープ（User/Managed）の deny とも競合しない**

→ `permissions.allow` への追加を提案。
  昇格先の目安:
  - チーム全員で使う → `.claude/settings.json`
  - 自分だけ・実験的 → `.claude/settings.local.json` または `~/.claude/settings.json`
  提案時は「追加しない」に加えて「プロジェクトローカル」「グローバル設定」を
  必ず選択肢として並べて提示する（ローカルのみを既定にせず、都度ユーザーに選ばせる）。
  承諾された場合のみ設定ファイルを編集する。

## ask 昇格基準
以下をいずれか満たす中リスクコマンド：
- 破壊的だが正当なケースがある（git push/commit/merge 等）
- 現在 deny だが、確認すれば実行したいケースが3回以上出た

→ `permissions.ask` への移行を提案。
  （ask は allow より優先される。同じ呼び出しに
   より具体的な allow がマッチしても ask が勝つ）

## deny 昇格基準
以下をいずれか満たす危険コマンド：
- Auto Memory に「事故りかけた」「意図せず実行された」記録がある
- 既存 allow/ask と競合する危険操作

→ `permissions.deny` への追加を提案。
  （deny は全スコープで優先。User/Managed に置くと広範囲に効く。
   案内時に「どのスコープに置くか」を必ず明示する）
