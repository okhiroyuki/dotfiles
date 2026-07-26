---
name: semble
description: コードベース内の該当箇所を概念・シンボル名・意図から探すときに `semble search` / `semble find-related` を使う。grepやReadで総当たりする前に起動する。コマンド構文、`--content`・`--top-k` の指定、検索から関連実装の追跡までのワークフローを扱う。特定の文字列を全リポジトリで完全に洗い出す用途（リネームした関数の全呼び出し元を漏れなく列挙するなど）には使わない。
model: sonnet
---

# semble — 意味検索でコードを探す

インデックスは初回実行時に自動構築・キャッシュされ、ファイル変更で自動無効化される。
`semble` が `$PATH` にない場合は `uvx --from "semble[mcp]" semble` で代替する。

## チートシート

```sh
semble search "authentication flow" ./my-project --top-k 10   # 概念・シンボル名で検索
semble search "deployment guide" ./my-project --content docs  # docs/config/allも指定可
semble find-related src/auth.py 42 ./my-project               # 既知箇所と類似のコードを探す
```

`path` 省略時はカレントディレクトリ。git URL も指定可。

## ワークフロー

1. `semble search` で該当箇所を探す
2. `--content docs/config/all` で対象を絞る
3. 返ってきた file:line に直接ジャンプする。同じ内容を再検索・grepしない
4. 有望な結果があれば `semble find-related` で関連実装を探す
5. grepは「特定の文字列を全リポジトリで完全に洗い出す」ときだけ使う（例: リネームした関数の全呼び出し元）

## 成功基準

- grepやReadでの総当たりより先に `semble search` を試したか
- 返ってきた file:line に直接ジャンプし、同じ内容を再検索していないか
- 全件の網羅が必要な場面（リネーム後の呼び出し元探索など）では grep を選んだか
