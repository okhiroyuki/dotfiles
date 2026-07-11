# claude/

[Claude Code](https://claude.com/product/claude-code) 向けの設定・スキルを置くディレクトリ。
`rcup` によって `~/.claude` にマージされる（ディレクトリ全体が丸ごとリンクされるのではなく、
配下の個々のファイルがシンボリックリンクされ、`~/.claude` 内の他のファイル・状態と共存する）。

この `README.md` はルートの `rcrc` の `EXCLUDES` に `README.md` が含まれているため、
`~/.claude/README.md` としてはリンクされない。

## 構成

```
claude/
└── skills/
    └── japanese-tech-writing/
        └── SKILL.md
```

- `skills/` — カスタム [Skill](https://docs.claude.com/en/docs/claude-code/skills) 定義を置く。
  - `skills/japanese-tech-writing/SKILL.md` — 日本語の技術文書・書籍原稿を書く/推敲するときの文章規範を定義したスキル。

## 新しい Skill を追加する

1. `claude/skills/<skill-name>/SKILL.md` を作成する。
2. front matter に `name` と `description` を書く。`description` はスキルが自動的に選ばれるかどうかを左右するので、
   どんな場面でトリガーすべきかが明確にわかるよう具体的に書く。
3. `rcup` を実行し、`~/.claude/skills/<skill-name>/SKILL.md` にリンクされたことを確認する。

## プラグイン（手動インストール）

Claude Code のプラグインは `claude plugin marketplace add` / `claude plugin install` コマンドで
`~/.claude.json` に状態が書き込まれる。この状態ファイルはキャッシュや feature flag と混在した
可変な巨大 JSON で、`rcup` によるシンボリックリンク管理には向かない。そのためプラグイン自体は
このリポジトリでは管理せず、**新しいマシンをセットアップするたびに以下の表を見ながら手動で
インストールする**運用にする。

新しくプラグインを導入したら、この表に行を追加して状態を更新すること。

| プラグイン | マーケットプレイス | 用途 | 状態 | インストールコマンド |
| --- | --- | --- | --- | --- |
| crit | `tomasz-tomczyk/crit` | ローカルファーストのレビューツール。diffやドキュメント、実行中のアプリをブラウザでレビューできる。 | 未導入 | `claude plugin marketplace add tomasz-tomczyk/crit`<br>`claude plugin install crit@crit` |

## 管理しないもの

`~/.claude/settings.json` や `~/.claude.json` のように Claude Code の実行に伴って書き換わる状態ファイルは、
このリポジトリでは管理しない（プラグインの状態を含む。詳細は上記「プラグイン」参照）。

なお、リポジトリ直下の `.claude/settings.local.json` はこの `claude/` ディレクトリとは無関係で、
`~/dotfiles` を作業ディレクトリとして Claude Code を使うとき用のプロジェクトローカル設定（`rcup` の管理対象外）。
