## Claude Code の settings.json 編集ルール

- `~/.claude/settings.json` に相当する変更を行う際は、`host-work/claude/settings.json` と `host-private/claude/settings.json` の両方を編集対象として扱う（両ファイルは共通化されておらず、独立している）
- 反映前に、変更内容が work / private 共通のルールか、どちらか一方の環境固有のルールかをユーザーに確認する
  - 共通の場合: 両方のファイルに同じ内容を反映する
  - 環境固有の場合: 該当する環境のファイルのみに反映する
