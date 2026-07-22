# lwiki

LLM-wiki の**配管 CLI**。保存先(root)を一度設定しておけば、任意のディレクトリから
記憶の蓄積・読み込み・再インデックスができる。

`llm-wiki` スキル（LLM）が「何を・どのカテゴリに・どう相互リンクして書くか」を判断し、
その結果の**ファイル配置・`_index.md`/`_log.md` 更新・`qmd` 再インデックス・検索呼び出し**という
機械的な部分だけをこの CLI が肩代わりする。中身の執筆・分類・重複判断は CLI では行わない。

## 前提

- Python 3.8+（標準ライブラリのみ。サードパーティ依存なし）
- 検索・再インデックスに [`qmd`](https://github.com/tobi/qmd) を使う（`qmd` が PATH に無い場合、`search`/`reindex` は警告を出してスキップする）

## セットアップ

`~/dotfiles/tools/lwiki` は `zshenv` で PATH に追加済みなので、シェルを開き直せば
`lwiki` コマンドがどこからでも使える。初回に保存先を設定する。

```sh
lwiki config set-root ~/Documents/llm-wiki
```

設定は `~/.config/llm-wiki/config.toml`（XDG）に保存され、リポジトリにはコミットされない。

## コマンド

| コマンド                              | 役割                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `lwiki config set-root <path>`        | 保存先(root)を設定する                                                 |
| `lwiki config get`                    | 現在の root を表示する                                                 |
| `lwiki config path`                   | 設定ファイルのパスを表示する                                           |
| `lwiki search <query> [-- <qmd引数>]` | `qmd query` で意味検索する（root 配下・任意の cwd から）               |
| `lwiki read <relpath>`                | root（または root/wiki）配下のページを表示する                         |
| `lwiki list [--category <cat>]`       | カテゴリ別にページ（パスとタイトル）を一覧する                         |
| `lwiki add ...`                       | ページを新規作成し、`_index.md`/`_log.md` 更新・再インデックスまで行う |
| `lwiki log "<msg>"`                   | `_log.md` に1行追記する                                                |
| `lwiki reindex`                       | `qmd update && qmd embed` を実行する                                   |

### `lwiki add`

```sh
# 意思決定(ADR)。ADR番号は Decisions/ を走査して自動採番する
echo "本文…" | lwiki add --category decision \
  --title "Claude vs GPT でClaudeを採用" --slug claude-vs-gpt \
  --summary "コスト・日本語性能で採用" --stdin

# 概念ページ。本文はファイルから
lwiki add --category concept --title "HPKI" --slug hpki \
  --summary "医療従事者の電子署名基盤" --body-file /tmp/hpki.md

# セッション。ファイル名は YYYY-MM-DD-<slug>.md になる
lwiki add --category session --title "○○薬局 訪問レポート" --slug foo-visit \
  --summary "要望ヒアリング" --stdin < notes.md
```

| オプション                | 説明                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `--category`              | `decision` / `prd` / `concept` / `research` / `session`                 |
| `--title`                 | ページタイトル（`# 見出し` と `_index.md` のリンク文言になる）          |
| `--summary`               | `_index.md` の1行要約                                                   |
| `--slug`                  | ファイル名の slug。省略時は title から自動生成。title が非ASCIIなら必須 |
| `--status`                | `decision` の frontmatter `status`（既定: `draft`。例: `accepted`）     |
| `--body-file` / `--stdin` | 本文の入力元（排他）。省略時は見出しだけのスタブ                        |
| `--no-reindex`            | `qmd` 再インデックスをスキップ                                          |
| `--dry-run`               | 書き込まず、作成予定のファイル・index/log 更新内容だけ表示する          |

カテゴリと配置・ファイル名・frontmatter の対応:

| category   | ディレクトリ      | ファイル名                      | frontmatter                              |
| ---------- | ----------------- | ------------------------------- | ---------------------------------------- |
| `decision` | `wiki/Decisions/` | `ADR-NNN-<slug>.md`（自動採番） | あり(date/status/tags/models_considered) |
| `prd`      | `wiki/PRDs/`      | `<slug>.md`                     | なし                                     |
| `concept`  | `wiki/Concepts/`  | `<slug>.md`                     | なし                                     |
| `research` | `wiki/research/`  | `<slug>.md`                     | なし                                     |
| `session`  | `wiki/sessions/`  | `YYYY-MM-DD-<slug>.md`          | なし                                     |

## 設計メモ

- `raw/` は不変資料のため `add` の対象外（`raw/` への配置は手動で行う）
- `_index.md` への挿入は `## <セクション>` 見出しを起点に、該当セクション末尾へ追記する。
  見出し構造を変えると挿入位置がずれるので、セクション見出しは現行のまま維持する
- 保存先の実データ（`~/Documents/llm-wiki`）は dotfiles の管理外
