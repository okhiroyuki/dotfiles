# textlint（AIっぽい日本語の検出）

AIが書いた日本語を2つのプリセットで検出する。
プロンプトで「この単語を使わないで」と指示しても守られるかは確率に左右されるため、リンターで決定論的に拾う。

- [textlint-rule-preset-ai-words-ja](https://github.com/p1ass/textlint-rule-preset-ai-words-ja) —
  単語そのもの（`効く` `核心` `道具` など）を形態素解析で検出する
- [@textlint-ja/textlint-rule-preset-ai-writing](https://github.com/textlint-ja/textlint-rule-preset-ai-writing) —
  記述の構造（絵文字リスト、誇張表現、述語＋コロンで始まるブロックなど）を検出する

対象が単語と構造で分かれており、上流も併用を想定しているため両方入れている。

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

判断できない状況（未インストール、nodeがPATHに無い、対象外の拡張子）では何も出力せず通す。
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
- `no-ai-list-formatting.disableBoldListItems` を `true` にしている。
  `- **ファイル名** — 説明` 形式の索引リストをskill群が9ファイルで使っており、
  これを検出対象にすると参照ファイルの一覧が書けなくなる。絵文字リストの検出は残している
- `ai-tech-writing-guideline` は無効にしている。「曖昧な判断表現」「7つのCの原則に基づいて見直しを」のような
  文書全体への助言が中心で、書き直しを促すhookのメッセージとしては具体性が足りない。
  なお上流が案内する `severity: "info"` はプリセット内の指定では反映されず、error のままになる（1.7.0で確認）

分野固有の単語を足したいときは `dictionaryPath` で辞書を追加できる（上流のREADMEを参照）。
ただしこの設定は全プロジェクト共通に適用されるため、特定の案件だけで必要な語はここに書かない。
