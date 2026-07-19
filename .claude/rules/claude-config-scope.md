## claude/ 配下に置いてよい設定の範囲

`claude/` は `rcup` で `~/.claude` にシンボリックリンクされ、全プロジェクトで共通して読み込まれるグローバル設定である。
`host-<name>/claude/`・`local/claude/` も同じ `~/.claude` へマージされる（詳細は次節）。

- 特定の会社・案件・顧客に紐づくドメイン知識（社内システム名、業務固有のAPI仕様、業務フローなど）を含むskill/ruleは、このリポジトリに追加しない。
- `host-<name>/` はマシン環境の違い（OS設定、業務ツールのパスなど）を吸収するためのものであり、機密情報や業務ドメイン知識の置き場ではない。
- 業務のドメイン知識を含む設定は `local/claude/` 配下（gitignoreされておりこのリポジトリにはコミットされない）に置く。
- 追加しようとしている設定がドメイン知識を含むか判断に迷う場合は、着手前にユーザーに確認する。

## グローバル設定のロード構造

`~/.claude` は3つのレイヤを `rcup` でマージした結果である。

- **claude/**：全マシン共通の設定。リポジトリにコミットされる。
- **host-\<name>/claude/**：マシン固有の設定。`rcup -B private` / `-B work` で選ばれる。コミットされる。
- **local/claude/**：ドメイン固有・機密の設定。gitignore対象でコミットされない。

同じリンク先が複数レイヤに存在するときは、`rcrc` の `DOTFILES_DIRS` で先に並ぶレイヤが勝つ。
本リポジトリは `local` を先頭に置くため、`local/claude/` は共有の `claude/` を上書きできる。

### グローバルルールの集約点は claude/CLAUDE.md 一つ

`~/.claude/CLAUDE.md` の実体は `claude/CLAUDE.md` だけである。
全マシンで同一のファイルが読まれ、`-B private` でも `-B work` でも変わらない。
集約点を host 側に置くと、その host の CLAUDE.md を用意し忘れたマシンでルールが一切ロードされない事故が起きる。
それを避けるため、集約点は共有の `claude/` に固定する。

### 会社・案件固有ルールの読み込み口

`claude/CLAUDE.md` は末尾で `@rules/local.md` を import する。
共有側の `claude/rules/local.md` は空スタブで、import を常に解決させるためだけに置いてある。
会社ルールが必要なマシンでは `local/claude/rules/local.md` を置く。
`local` が優先されるので、この実体が空スタブを上書きして読み込まれる。

git に残る会社関連の痕跡は `@rules/local.md` の1行だけになる。
会社名・案件名を含む文字列を、共有側（`claude/`・`host-<name>/`）の import 行やファイル名に書かない。

### host-work を claude ルールに使わない理由

マシン間のルールの差分は「共通ルール + 会社ルール」という追加のみで、共通ルールを減らす方向の差分は想定しない。
追加は `local/claude/rules/local.md` の有無だけで表現できるため、host ごとに別の集約点を作る必要がない。
`host-work/` を作るのは、work用の `gitconfig` や `Brewfile` などマシン固有の非claude設定が必要になったときに限る。
