---
description: シグネチャだけ知りたいときはcat/Readではなくzatを使う
---

## Code Outline

- ファイルの全文ではなくエクスポートされたシンボルのシグネチャだけ知りたいときは、`cat` / Read ではなく `zat` を使う
- `zat` の出力に含まれる行番号を使い、必要な箇所だけ `Read(offset, limit)` で読む
- 対応言語: C, C++, C#, Go, Haskell, Java, JavaScript, Kotlin, Markdown, Python, Ruby, Rust, Swift, TypeScript/TSX。
  非対応言語では exit code 1 を返すので、その場合は Read にフォールバックする
