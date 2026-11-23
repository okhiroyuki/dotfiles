# llm-wiki

LLM-wiki の**配管 CLI**。保存先(root)を一度設定しておけば、任意のディレクトリから
記憶の蓄積・読み込みができる。

`llm-wiki` スキル（LLM）が「何を・どのカテゴリに・どう相互リンクして書くか」を判断し、
その結果の**ファイル配置・`_index.md`/`_log.md` 更新・検索呼び出し**という
機械的な部分だけをこの CLI が肩代わりする。中身の執筆・分類・重複判断は CLI では行わない。

## 前提

- Python 3.8+（標準ライブラリのみ。サードパーティ依存なし）
- 検索に `semble` を使う（`semble` が PATH に無い場合、`search` は警告を出してスキップする）。
  semble はファイル変更を自動検知してインデックスを無効化するため、明示的な再インデックスは不要

## セットアップ

`~/dotfiles/tools/cli/llm-wiki` は `zshenv` で PATH に追加済みなので、シェルを開き直せば
`llm-wiki` コマンドがどこからでも使える。初回に保存先を設定する。

```sh
llm-wiki config set-root ~/Documents/llm-wiki
```

設定は `~/.config/llm-wiki/config.toml`（XDG）に保存され、リポジトリにはコミットされない。

## コマンド

| コマンド                                                              | 役割                                                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `llm-wiki config set-root <path>`                                     | 保存先(root)を設定する                                                                                                                                 |
| `llm-wiki config get`                                                 | 現在の root を表示する                                                                                                                                 |
| `llm-wiki config path`                                                | 設定ファイルのパスを表示する                                                                                                                           |
| `llm-wiki search [--scope wiki\|raw\|root] <query> [-- <semble引数>]` | `semble search --content docs` で意味検索する。既定の範囲は `wiki/`。`--scope raw` で raw/、`--scope root` で全体。`--scope` は query より前に指定する |
| `llm-wiki read <relpath>`                                             | root（または root/wiki）配下のページを表示する                                                                                                         |
| `llm-wiki list [--category <cat>]`                                    | カテゴリ別にページ（パスとタイトル）を一覧する                                                                                                         |
| `llm-wiki add ...`                                                    | ページを新規作成し、`_index.md`/`_log.md` を更新する                                                                                                   |
| `llm-wiki log "<msg>"`                                                | `_log.md` に1行追記する                                                                                                                                |

### `llm-wiki add`

```sh
# 意思決定(ADR)。ADR番号は Decisions/ を走査して自動採番する
echo "本文…" | llm-wiki add --category decision \
  --title "Claude vs GPT でClaudeを採用" --slug claude-vs-gpt \
  --summary "コスト・日本語性能で採用" --stdin

# 概念ページ。本文はファイルから
llm-wiki add --category concept --title "OAuth 2.0" --slug oauth2 \
  --summary "認可の標準プロトコル" --body-file /tmp/oauth2.md

# セッション。ファイル名は YYYY-MM-DD-<slug>.md になる
llm-wiki add --category session --title "設計レビュー 議事メモ" --slug design-review \
  --summary "論点整理" --stdin < notes.md
```

| オプション                | 説明                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `--category`              | `decision` / `prd` / `concept` / `research` / `session`                 |
| `--title`                 | ページタイトル（`# 見出し` と `_index.md` のリンク文言になる）          |
| `--summary`               | `_index.md` の1行要約                                                   |
| `--slug`                  | ファイル名の slug。省略時は title から自動生成。title が非ASCIIなら必須 |
| `--status`                | `decision` の frontmatter `status`（既定: `draft`。例: `accepted`）     |
| `--body-file` / `--stdin` | 本文の入力元（排他）。省略時は見出しだけのスタブ                        |
| `--dry-run`               | 書き込まず、作成予定のファイル・index/log 更新内容だけ表示する          |

カテゴリと配置・ファイル名・frontmatter の対応:

| category   | ディレクトリ      | ファイル名                      | frontmatter                              |
| ---------- | ----------------- | ------------------------------- | ---------------------------------------- |
| `decision` | `wiki/Decisions/` | `ADR-NNN-<slug>.md`（自動採番） | あり(date/status/tags/models_considered) |
| `prd`      | `wiki/PRDs/`      | `<slug>.md`                     | なし                                     |
| `concept`  | `wiki/Concepts/`  | `<slug>.md`                     | なし                                     |
| `research` | `wiki/research/`  | `<slug>.md`                     | なし                                     |
| `session`  | `wiki/sessions/`  | `YYYY-MM-DD-<slug>.md`          | なし                                     |

## 検索品質のeval

`search_eval.py` は評価セット（クエリと正解ページの対）について
実際の `llm-wiki search` を実行して、top-1 的中率と top-10 内の到達率を報告する。
あわせてノイズケース（どのページも正解でないクエリ）について
スコアの平たさを報告する。
プロンプトの言い換えで正解ページに辿り着けるかを確認する回帰テストである。

```sh
# 文書が20件程度に増えた時点・検索まわりを変更した時 恒例
python3 tools/cli/llm-wiki/search_eval.py                 # 人間可読
python3 tools/cli/llm-wiki/search_eval.py --json          # 機械可読
python3 tools/cli/llm-wiki/search_eval.py --gold <path>   # 評価セットを指定
```

wiki の中身はマシンごとに違うため、評価セットは次の順で探す。

1. `--gold` で指定したファイル
2. `<root>/search_evals.json`（wiki 側。dotfiles の管理外）
3. このディレクトリの `search_evals.json`（私用マシンの wiki 向け）

業務の語を含む評価セットは 2 に置き、dotfiles にコミットしない。
正解ページが root 配下にないケースは「対象外」として的中率に数えない。
正解ケースがすべて対象外なら、評価セットがその wiki に合っていないので、
警告を出して終了コード 1 で終わる。

クエリ追加は評価セットに `"query"` と `"expected"`（root 相対パス。
正解なしのノイズ計測なら `null`）を追記するだけ。
任意で `"kind"`（例: `具体` / `言い換え`）を付けると、kind ごとの内訳も出る。

## 設計メモ

- `raw/` は不変資料のため `add` の対象外（`raw/` への配置は手動で行う）
- `_index.md` への挿入は `## <セクション>` 見出しを起点に、該当セクション末尾へ追記する。
  見出し構造を変えると挿入位置がずれるので、セクション見出しは現行のまま維持する
- 保存先の実データ（`~/Documents/llm-wiki`）は dotfiles の管理外
