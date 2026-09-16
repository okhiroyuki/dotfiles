# textlint（日本語Markdownの検出）

AIが書いた日本語と、技術文書として雑な日本語を3つのプリセットで検出する。
プロンプトで「この単語を使わないで」と指示しても守られるかは確率に左右されるため、リンターで決定論的に拾う。

- [textlint-rule-preset-ai-words-ja](https://github.com/p1ass/textlint-rule-preset-ai-words-ja) —
  単語そのもの（`効く` `核心` `道具` など）を形態素解析で検出する
- [@textlint-ja/textlint-rule-preset-ai-writing](https://github.com/textlint-ja/textlint-rule-preset-ai-writing) —
  記述の構造（絵文字リスト、誇張表現、述語＋コロンで始まるブロックなど）を検出する
- [textlint-rule-preset-ja-technical-writing](https://github.com/textlint-ja/textlint-rule-preset-ja-technical-writing) —
  技術文書の表記（文の長さ、読点の過多、ら抜き、二重否定、対になっていない括弧など）を検出する

対象が単語・構造・技術文書の表記で分かれており、上流も併用を想定しているため並べて入れている。

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
- `ja-no-weak-phrase` は無効にしている。japanese-tech-writing が、根拠のない弱めだけを削り、
  未確認の可能性・推量・読者の疑念は残すよう定めている。機械的に「かも」を落とすと規範と衝突する
- `no-exclamation-question-mark` は無効にしている。同スキルが見出しの疑問形を許容し、
  議論の山場では感嘆符つきの短い一文も許容している
- `no-doubled-joshi` は無効にしている。助詞の連続は例外が多く、hookの指摘が文意と無関係な書き換えを誘う
- `max-kanji-continuous-len` は無効にしている。技術用語の複合漢字は6文字を超えることが常であり、
  上流自身も例外前提のルールだと書いている
- `arabic-kanji-numbers` は無効にしている。「一つ」を「1つ」に直す類の指摘が、スキル本文の自然な日本語と衝突する
- `no-mix-dearu-desumasu` は本文・見出し・箇条書きの希望文体を空にしている。
  この設定は全プロジェクトのMarkdownに掛かるため、ですます調のREADMEとである調のスキルを
  どちらか一方へ寄せられない。混在の検出だけ残す

分野固有の単語を足したいときは `dictionaryPath` で辞書を追加できる（上流のREADMEを参照）。
ただしこの設定は全プロジェクト共通に適用されるため、特定の案件だけで必要な語はここに書かない。
