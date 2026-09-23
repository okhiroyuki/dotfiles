---
description: コード検索はgrepではなくsembleを使う
---

## Code Search

- コードベース内の該当箇所を探すときは、grep や Read での総当たりではなく `semble search` を使う。
  コマンド構文・ワークフローは `semble` スキルに従う
- grep は「特定の文字列を全リポジトリで完全に洗い出す」ときだけ使う（例: リネームした関数の全呼び出し元）
