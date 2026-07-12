# local/

マシン固有・業務ドメイン固有など、このリポジトリにコミットしたくない設定を置く場所。

- `local/` 配下は `README.md` を除いて `.gitignore` されており、git の管理対象外。
- `rcup` は `rcrc` の `DOTFILES_DIRS` 設定によりこのディレクトリも `~/dotfiles` と同様にスキャンし、トップレベルの各エントリを `~/` 以下へシンボリックリンクする（例: `local/claude/skills/xxx` → `~/.claude/skills/xxx` にマージされる）。
- 例: 会社の業務ドメイン知識を含む Claude Code の skill/rule は `local/claude/skills/`・`local/claude/rules/` に置く。

新しいマシンでは、このディレクトリ自体が git 管理外のため clone 直後は空。必要なファイルを手動で配置してから `rcup` を実行する。
