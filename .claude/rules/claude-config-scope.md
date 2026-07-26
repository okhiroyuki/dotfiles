## claude/ 配下に置いてよい設定の範囲

`claude/` は `rcup` で `~/.claude` にシンボリックリンクされ、全プロジェクトで共通して読み込まれるグローバル設定である。
`host-<name>/claude/`・`local/claude/` も同じ `~/.claude` へマージされる。

- 特定の会社・案件・顧客に紐づくドメイン知識（社内システム名、業務固有のAPI仕様、業務フローなど）を含むskill/ruleは、このリポジトリに追加しない。
- `host-<name>/` はマシン環境の違い（OS設定、業務ツールのパスなど）を吸収するためのものであり、機密情報や業務ドメイン知識の置き場ではない。
- 業務のドメイン知識を含む設定は `local/claude/` 配下（gitignoreされておりこのリポジトリにはコミットされない）に置く。
- 会社名・案件名を含む文字列を、共有側（`claude/`・`host-<name>/`）の import 行やファイル名に書かない。
- 追加しようとしている設定がドメイン知識を含むか判断に迷う場合は、着手前にユーザーに確認する。

## グローバル設定のロード構造

`~/.claude` は3つのレイヤを `rcup` でマージした結果である。

- **claude/**：全マシン共通の設定。リポジトリにコミットされる。グローバルルールの集約点は `claude/CLAUDE.md` 一つに固定する。
- **host-\<name>/claude/**：マシン固有の設定。`rcup -B private` で選ばれる。コミットされる。`settings.json` はここに置く。
- **local/claude/**：ドメイン固有・機密の設定。gitignore対象でコミットされない。

同じリンク先が複数レイヤに存在するときは、`rcrc` の `DOTFILES_DIRS` で先に並ぶレイヤが勝つ。
本リポジトリは `local` を先頭に置くため、`local/claude/` は共有の `claude/` を上書きできる。

`claude/rules/local.md` は import を解決させるための空スタブで、本文は1行に留める（ambient に載るため）。
会社ルールが必要なマシンでは `local/claude/rules/local.md` を置き、`local` 優先でスタブを上書きさせる。

## 設計判断の根拠

上記の配置をなぜそうしているか（集約点を共有側に固定する理由、`settings.json` をあえて host 側に置く理由、
`host-work/` を claude ルールに使わない理由、スタブを最小限に保つ理由）は
[.claude/docs/claude-config-design.md](../docs/claude-config-design.md) にある。
配置を変えるとき・例外を作りたいときは先にそちらを読む。
