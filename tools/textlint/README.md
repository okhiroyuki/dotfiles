# textlint（日本語Markdownの検出）

AI が書いた日本語と、技術文書として雑な日本語を 3 つのプリセットで検出する。
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
Claude Code が `*.md` を Write / Edit するたびに
[claude/hooks/textlint-ai-words.sh](../../claude/hooks/textlint-ai-words.sh) 経由で実行される。
指摘があれば exit 2 で stderr に返り、エージェントが自分で書き直す。

判断できない状況（未インストール、node が PATH に無い、対象外の拡張子）では何も出力せず通す。
英語中心のリポジトリなどで一時的に止めたいときは `TEXTLINT_AI_WORDS_SKIP=1` を渡す。

## 手動での実行

このリポジトリ内の Markdown をまとめてチェックする。

```shell
mise run lint:text
```

`mise run lint` には含めていない。既存のドキュメントに指摘が多く残っており、
コミットを止める種類のチェックとしては運用できないため、意図的に手動タスクに留めている。

## 設定

検出設定の単一の真実の源は [.textlintrc.json](.textlintrc.json)。

[nakita628/technical-document-lint](https://github.com/nakita628/technical-document-lint) のベストプラクティス設定から追加した部分：

- `preset-ja-spacing` を追加した。空白の入れ方を機械に任せる
  （和文と英数字の間に半角スペース、コードとリンクの前後に空白、括弧の内側は入れない）
- `prh` を追加した。表記ゆれ（ユーザー/サーバー、出来る/できる、GitHub/JS製品名の綴り）を
  [dict/prh.yml](dict/prh.yml) の辞書で統一する。閾値の根拠は出典リポジトリの
  [docs/RESEARCH.md](https://github.com/nakita628/technical-document-lint/blob/main/docs/RESEARCH.md)（Zenn / Qiita / note のトレンド記事 219 本の実測）
- `sentence-length` を `max: 100` に緩めた。実測の 95 パーセンタイルが 77 文字で、
  100 文字は「普通に書いていれば当たらない」上限になる（デフォルトの 90 から緩和）
- 衝突するルール（`no-doubled-joshi`、`ja-no-weak-phrase` など）は無効のまま引き上げていない。
  既存の無効化理由（下記）を優先する

既存の設定判断：

- `no-ai-words.allows` に `断定`、`経路`、`漏れ` を入れている。
  `japanese-tech-writing` は AI 語の指摘を補助検査として扱い、文脈上正確な語の使用を許容する。
  「断定と推量の使い分け」のように規範上必要な語は、機械的な指摘から除外する
- `no-short-topic-comma` は無効にしている。「〜は、」で主題を示す書き方は日本語として自然な場面も多く、
  指摘が多すぎて hook のフィードバックが埋もれる
- `no-ai-list-formatting.disableBoldListItems` を `true` にしている。
  `- **ファイル名** — 説明` 形式の索引リストを skill 群が 9 ファイルで使っており、
  これを検出対象にすると参照ファイルの一覧が書けなくなる。絵文字リストの検出は残している
- `ai-tech-writing-guideline` は無効にしている。「曖昧な判断表現」「7 つの C の原則に基づいて見直しを」のような
  文書全体への助言が中心で、書き直しを促す hook のメッセージとしては具体性が足りない。
  なお上流が案内する `severity: "info"` はプリセット内の指定では反映されず、error のままになる（1.7.0 で確認）
- `ja-no-weak-phrase` は無効にしている。japanese-tech-writing が、根拠のない弱めだけを削り、
  未確認の可能性・推量・読者の疑念は残すよう定めている。機械的に「かも」を落とすと規範と衝突する
- `no-exclamation-question-mark` は無効にしている。同スキルが見出しの疑問形を許容し、
  議論の山場では感嘆符つきの短い一文も許容している
- `no-doubled-joshi` は無効にしている。助詞の連続は例外が多く、hook の指摘が文意と無関係な書き換えを誘う
- `max-kanji-continuous-len` は無効にしている。技術用語の複合漢字は 6 文字を超えることが常であり、
  上流自身も例外前提のルールだと書いている
- `arabic-kanji-numbers` は無効にしている。「一つ」を「1 つ」に直す類の指摘が、スキル本文の自然な日本語と衝突する
- `no-mix-dearu-desumasu` は本文を「ですます」、箇条書きを「である」に寄せて有効にした
  （nakita628/technical-document-lint の実測では 84.3 パーセントがですます調）。見出しは体言止めが多く判定外。
  残存する「である」混入文は追って「ですます」に寄せる。当初は本文の希望を空にして混在検出だけにしていたが、
  全プロジェクトの文体をですます調に揃える方針に決めたため preference を入れた

分野固有の単語を足したいときは `dictionaryPath` で辞書を追加できる（上流の README を参照）。
ただしこの設定は全プロジェクト共通に適用されるため、特定の案件だけで必要な語はここに書かない。
