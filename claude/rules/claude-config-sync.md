---
description: Claude Code設定変更後の確認ルール
---

## Claude Code設定変更後の確認

- Claude Codeの設定(settings.json, CLAUDE.md, hooksなど)を変更した場合、変更内容をdotfilesリポジトリ側(`~/dotfiles`)で確認する
  - `~/.claude` 配下はrcmでdotfilesリポジトリにシンボリックリンクされているため、変更自体は自動的にリポジトリに反映される
  - host-work / host-private どちらに反映すべきか、あるいは両方かは自動判断できないため、dotfilesリポジトリの `.claude/CLAUDE.md` にある詳細ルールを参照して確認する
