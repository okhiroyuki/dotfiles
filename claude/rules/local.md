<!--
ローカル・業務ドメイン固有ルールのプレースホルダ（空スタブ・committed）。

このファイル自体は意図的に空。会社ルールなどマシン固有の設定が必要なマシンでは、
`local/claude/rules/local.md`（gitignore配下）を置くと、rcm の優先順位
（rcrc の DOTFILES_DIRS 先頭が `local`）により、このスタブを上書きして読み込まれる。

- 共通ルールに混ぜたくない業務ドメイン知識は必ず `local/` 側へ書く（このファイルには書かない）
- 詳細は local/README.md と .claude/rules/claude-config-scope.md を参照
-->
