---
description: スキルのevals/evals.jsonに基づき、スキルあり/なし比較evalを実行して合否を判定する
agent: build
subtask: true
---

# Skill Eval Runner

引数 `$ARGUMENTS` で指定されたスキルの eval を実行します。引数が空の場合は、直近の会話で編集した SKILL.md のスキル名を推測します。それも特定できない場合は、スキル名を尋ねて終了します。

## Step 1: evals.json の読み込み

対象スキルの `evals/evals.json` を探して読みます。探索順は次のとおりです。

1. `~/.claude/skills/<name>/evals/evals.json`
2. `~/.agents/skills/<name>/evals/evals.json`
3. `.opencode/skill/<name>/evals/evals.json`

`evals.json` が存在しない場合、その旨を報告して終了します。勝手に作らないでください。作成は skill-management スキルの手順に従う作業です。

## Step 2: 各 eval ケースを subagent で並行実行

`evals.json` の `evals` 配列の各ケースについて、1メッセージで複数の Task ツール呼び出しを並行発行します。各ケースにつき2つの subagent を起動します。

1. スキルあり: subagent のプロンプト先頭に、対象スキルの SKILL.md 全文を `# Skill: <name>` と本文の形式で埋め込みます。その後に eval ケースの `prompt` を続けて「この指示に従って応答せよ」と渡します
2. baseline（スキルなし）: SKILL.md を埋め込まず、eval ケースの `prompt` と「この指示に従って応答せよ」のみ渡します

subagent には research であることを明示し、ファイル編集をさせません。各 subagent からは最終応答本文のみを受け取ります。

## Step 3: expectations との比較と合否報告

baseline とスキルありの応答を比較し、各 `expectations` 項目がスキルあり応答で満たされているかを1項目ずつ判定します。baseline も expectations を満たす場合、その expectation はスキルの効果を検証できないため「区別不能」として報告します。

最終出力は次の形式に従います。

```
## Skill Eval: <skill_name> (model: <モデル名>)

### Case <id>: <promptの要約>
| # | expectation | 判定 |
|---|-------------|------|
| 1 | ...         | pass / fail / 区別不能 |

- baseline差分: <スキルありのみ満たした項目数> / <expectations総数>
- 判定: PASS（全expectationsを満たし、baselineとの差分あり） / FAIL / 改善余地（区別不能が多い）

<fail項目があれば、SKILL.mdのどの記述が効いていないか分析し、改訂案を1文で提示>
```

FAIL の場合、スキル本文の改訂と再実行をユーザーに提案します。勝手に改訂や再実行はしません。
