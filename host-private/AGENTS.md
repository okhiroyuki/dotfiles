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
  - package.json は例外的に管理する(`@opencode/plugin` のバージョン指定がプラグイン API との
    互換性を決めるため。`^` で 2.x に追従し、opencode 更新時に挙動が変わったら確認する)。
    lock ファイル・node_modules はコミットしない

## opencode

- カスタムツール(CLI ラッパー)は `host-private/config/opencode/plugins/<cli名>.ts` に置く
  - 例: ax-fetch.ts(ax CLI)、semble.ts(semble CLI)
- プラグインは V2 API(`Plugin.define({ id, setup })` + デフォルト export)で書く。
  V1 形式(名前付き export の関数)は V2 ではロードされない
- plugins/* は rcrc の COPY_ALWAYS 対象(実体コピー)。リポジトリ編集の反映は `rcup -B private`
  - シムリンクにしないのは、Bun のモジュール解決が実パス(dotfiles 側)の node_modules を
    見に行き `@opencode/plugin` が見つからなくなるため
- opencode.jsonc の permission キーは、プラグインが登録するツールID(`tool: { <キー>: ... }` のキー)と完全一致させる
- 設定変更は起動時にロードされるため、反映には opencode 自体の再起動が必要
- 新マシン構築時は `~/.config/opencode` で `npm install`(または `bun install`)を一度実行する
  (リンクされた package.json の `@opencode/plugin` が入るまでプラグインはロードされない)

## 検証

- 変更後は `mise run lint` を実行する(dprint / yamllint / shellcheck / actionlint)
