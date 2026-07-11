---
description: Claude Codeの設定ルール
---

## Claude Code の settings.json 編集ルール

- `~/.claude/settings.json` に相当する変更を行う際は、`host-work/claude/settings.json` と `host-private/claude/settings.json` の両方を編集対象として扱う（両ファイルは共通化されておらず、独立している）
- 反映前に、変更内容が work / private 共通のルールか、どちらか一方の環境固有のルールかをユーザーに確認する
  - 共通の場合: 両方のファイルに同じ内容を反映する
  - 環境固有の場合: 該当する環境のファイルのみに反映する

## Claude Code の plugin 追加ルール

- 新しいplugin（marketplace）を追加する際は、work / private 共通で使うものか、どちらか一方の環境専用かをユーザーに確認する
  - 共通の場合: `zsh/configs/_claude.zsh` に既存と同じ形のインストールブロックを追加する
  - 環境固有の場合: `host-work/zsh/configs/claude.zsh` または `host-private/zsh/configs/claude.zsh`（なければ新規作成）に追加する
- `scripts/update-plugins.sh` は `settings.json` の `enabledPlugins` を動的に読むため、追記不要
