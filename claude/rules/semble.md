---
description: githubのコード検索ルール
---

## Code Search

grepの代わりに`semble search`を使う。インデックスは初回実行時に自動構築・キャッシュされ、ファイル変更で自動無効化される。`semble`が`$PATH`にない場合は`uvx --from "semble[mcp]" semble`で代替する。

​`bash
semble search "authentication flow" ./my-project --top-k 10   # 概念・シンボル名で検索
semble search "deployment guide" ./my-project --content docs  # docs/config/allも指定可
semble find-related src/auth.py 42 ./my-project               # 既知箇所と類似のコードを探す
​`

`path`省略時はカレントディレクトリ、git URLも指定可。

### Workflow

1. `semble search`で該当箇所を探す
2. `--content docs/config/all`で対象を絞る
3. 返ってきたfile:lineに直接ジャンプする。同じ内容を再検索・grepしない
4. 有望な結果があれば`semble find-related`で関連実装を探す
5. grepは「特定の文字列を全リポジトリで完全に洗い出す」ときだけ使う（例: リネームした関数の全呼び出し元）
