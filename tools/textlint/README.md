# textlint（AIっぽい日本語の検出）

[textlint-rule-preset-ai-words-ja](https://github.com/p1ass/textlint-rule-preset-ai-words-ja) を使い、
AIが書いた日本語に出やすい単語（「効く」「核心」「道具」など）を形態素解析で検出する。
プロンプトで「この単語を使わないで」と指示しても守られるかは確率に左右されるため、リンターで決定論的に拾う。

## セットアップ

```shell
mise run install:textlint
```

`mise run setup` からも呼ばれるので、通常は個別実行の必要はない。

## Claude Codeのhookとしての動作

`host-private/claude/settings.json` の `PostToolUse` に登録してあり、
Claude Codeが `*.md` を Write / Edit するたびに
[claude/hooks/textlint-ai-words.sh](../../claude/hooks/textlint-ai-words.sh) 経由で実行される。
指摘があれば exit 2 で stderr に返り、エージェントが自分で書き直す。

判断できない状況（未インストール、nodeがPATHに無い、対象外の拡張子）では黙って通す。
英語中心のリポジトリなどで一時的に止めたいときは `TEXTLINT_AI_WORDS_SKIP=1` を渡す。

## 手動での実行

このリポジトリ内のMarkdownをまとめてチェックする。

```shell
mise run lint:text
```

`mise run lint` には含めていない。既存のドキュメントに指摘が多く残っており、
コミットを止める種類のチェックとしては運用できないため、意図的に手動タスクに留めている。

## 設定

検出設定の単一の真実の源は [.textlintrc.json](.textlintrc.json)。

- `no-ai-words.allows` に `断定` を入れている。
  [japanese-tech-writing](../../claude/skills/japanese-tech-writing/SKILL.md) スキルが
  「断定と推量の使い分け」を規範の用語として使っており、言い換えると規範自体が読めなくなる
- `no-short-topic-comma` は無効にしている。「〜は、」で主題を示す書き方は日本語として自然な場面も多く、
  指摘が多すぎてhookのフィードバックが埋もれる

分野固有の単語を足したいときは `dictionaryPath` で辞書を追加できる（上流のREADMEを参照）。
ただしこの設定は全プロジェクト共通で効くため、特定の案件だけで必要な語はここに書かない。
