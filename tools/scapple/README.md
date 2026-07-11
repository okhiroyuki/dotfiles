# scapple

Scappleの`.scap`ファイル（XML）を、座標・色・フォントなどを除いたノードと接続関係の構造化JSONに変換するCLI。

## セットアップ

初回のみ、グローバルコマンドとしてインストールする。

```bash
cd ~/dotfiles/tools/scapple
pnpm install
pnpm run build
pnpm add -g .
```

## 使い方

```bash
scapple <file.scap> --format json   # 構造化JSON（デフォルト）
scapple <file.scap> --format text   # 人間が読みやすいテキスト
```

出力される`notes`は`{id, text, connectedTo, pointsTo}`の配列、`stacks`は縦積みグループのID配列（並び順が意味を持つ）。

## 開発

```bash
pnpm exec tsx bin/scapple.ts <file.scap>   # ビルドせずに直接実行
pnpm run build                             # dist/ にビルド
pnpm exec tsc --noEmit                     # 型チェックのみ
```
