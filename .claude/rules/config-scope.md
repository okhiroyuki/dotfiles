---
description: Claude Code設定変更時のスコープ確認ルール
---

## Claude Code設定変更時のスコープ確認

dotfilesリポジトリでClaude Codeの設定（settings.json, CLAUDE.md, rules, hooks, skillsなど）を変更する際は、着手前に対象スコープを確認する。

1. **ローカル or グローバル**
   - `.claude/`: dotfilesリポジトリ自身のプロジェクトローカル設定（rcmの管理対象外、他プロジェクトには影響しない）
   - `claude/`: rcmで `~/.claude` にシンボリックリンクされ、全プロジェクト共通で読み込まれるグローバル設定
2. **グローバルの場合、共通 or 環境固有**
   - `claude/`: work / private 共通のルール
   - `host-work/claude/` または `host-private/claude/`: どちらか一方の環境固有の設定
   - settings.jsonの具体的な反映先の判断は `.claude/rules/claude-settings.md` に従う
3. 対象がどちらか自明でない場合は、変更前にユーザーに確認する

## ディレクトリ構成の詳細

- `claude/rules/*.md` … 全マシン共通のルール（実体はここだけ）。タグ無しで全マシンの `~/.claude/rules/` へ配置される。
- `claude/CLAUDE-common.md` … 共通ルールをまとめて読み込むインデックス。`~/.claude/CLAUDE-common.md` へ配置される。
- `claude/skills/*` … 全マシン共通の skill。
- `host-*/claude/CLAUDE.md` … 各 host のエントリポイント（`~/.claude/CLAUDE.md`）。`@CLAUDE-common.md` で共通を読み込み、その後に host 固有ルールを `@rules/xxx.md` で追加する。
- `host-*/claude/rules/*.md` … その host だけのルール（例: `host-private/claude/rules/pre-commit.md`）。

`rcup -B <tag>` を実行すると、共通ファイルと host 固有ファイルが同じ `~/.claude/rules/` にマージされる。共通ルールを直すときは `claude/rules/` の 1 ファイルを編集すればよい。
