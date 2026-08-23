# AGENTS.md

このリポジトリ(dotfiles)で作業するときの配置ルール。新規ファイルを作る前に必ず確認すること。

## 配置の判定

| 置き場所       | 用途                                              |
| -------------- | ------------------------------------------------- |
| リポジトリ直下 | 全マシン共通の設定(zshrc, gitconfig, tigrc など)  |
| host-private/  | private マシン専用                                |
| local/         | マシン固有の個人設定。gitignored だが rcup は読む |

## シムリンクの仕組み

- ホームへのリンクは rcm(`rcup -B private`)が張る。手動で `ln -s` しない
- 直下のファイルは `~/.<名前>` に、`config/<アプリ>/` 配下は `~/.config/<アプリ>/` に対応する
  - 例: `host-private/config/opencode/opencode.jsonc` → `~/.config/opencode/opencode.jsonc`
- rcrc の EXCLUDES(README.md, LICENSE, mise.toml, tools/* など)はリンク対象外のメタファイル
  - ルート直下にメタファイル(ドキュメント・CI 設定など)を追加したら EXCLUDES への追加を忘れない
- `~/.config/<アプリ>` 側に node_modules などの追跡対象外ファイルが必要な場合(opencode など)は、
  `~/.config` 側を実ディレクトリにして、rcm に配下を個別シムリンクさせる
  - package.json・lock ファイル・node_modules はリポジトリにコミットしない

## opencode

- カスタムツール(CLI ラッパー)は `host-private/config/opencode/plugins/<cli名>.ts` に置く
  - 例: ax-fetch.ts(ax CLI)、semble.ts(semble CLI)
- opencode.jsonc の permission キーは、プラグインが登録するツールID(`tool: { <キー>: ... }` のキー)と完全一致させる
- 設定変更は起動時にロードされるため、反映には opencode 自体の再起動が必要

## 検証

- 変更後は `mise run lint` を実行する(dprint / yamllint / shellcheck / actionlint)
