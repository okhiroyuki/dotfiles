---
description: コード検索はgrepではなくsembleを使う
---

## Code Search

- コードベース内の該当箇所を探すときは、grep や Read での総当たりではなく semble を使う
- MCP クライアント(パターンが `mcp__semble__*` のツール、例: `mcp__semble__search`)が
  使える環境ではそちらを優先する。MCP はモデルとインデックスを常駐させるため、
  CLI 都度 spawn(約 0.5 秒)に比べて 1 コールあたり 0.01〜0.03 秒で済む
- MCP ツールの引数は CLI と一部異なる。検索対象ディレクトリは `repo`(CLI の `path` に相当)。
  `top_k`・`max_snippet_lines`・`content` は共通
- MCP が使えない環境では `semble search` CLI を使う。コマンド構文・ワークフローは
  `semble` スキルに従う
- grep は「特定の文字列を全リポジトリで完全に洗い出す」ときだけ使う（例: リネームした関数の全呼び出し元）
