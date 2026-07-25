# scapple

Scappleの`.scap`ファイル（XML）を、座標・色・フォントなどを除いたノードと接続関係の構造化JSONに変換するCLI。
逆に、構造化JSONから`.scap`を書き出すこともできる。

## セットアップ

初回のみ、グローバルコマンドとしてインストールする。

```bash
cd ~/dotfiles/tools/scapple
pnpm install
pnpm run build
pnpm add -g .
```

## 使い方

### 読み込む（.scap → 構造化データ）

```bash
scapple <file.scap> --format json   # 構造化JSON（デフォルト）
scapple <file.scap> --format text   # 人間が読みやすいテキスト
```

出力される`notes`は`{id, text, connectedTo, pointsTo}`の配列、`stacks`は縦積みグループのID配列（並び順が意味を持つ）。

### 書き出す（構造化データ → .scap）

```bash
scapple build <input.json> -o out.scap   # ファイルから
cat input.json | scapple build -o out.scap   # 標準入力から（ファイル名の省略・`-`も同じ）
```

入力は読み込み時と同じスキーマのJSON。
`text`、`connectedTo`、`pointsTo`、`stacks`は省略できる。

```json
{
  "notes": [
    { "id": 0, "text": "豆を挽く" },
    { "id": 1, "text": "抽出" },
    { "id": 2, "text": "味", "connectedTo": [3] },
    { "id": 3, "text": "焙煎度", "pointsTo": [2] }
  ],
  "stacks": [[0, 1]]
}
```

- **座標は指定しない。**
  接続グラフを連結成分に分け、成分ごとに幅優先探索の深さを列に割り当てて自動配置する。
  同じ入力からは常に同じ座標が出る。
- スタックは同じ列に32px間隔で並べる。
  Scappleはこの間隔で密着していないと縦積みとして扱わない。
- 幅は`<AutoFit>`に全ノートを登録してScapple側の自動調整に任せるため、`Width`の指定も不要。
- 接続は既定で矢印のない点線になる。
  Scappleの通常の接続がこの点線で、`pointsTo`に書いたときだけ矢尻が付く。
  矢印を使わない運用では`connectedTo`だけで足りる。
- `connectedTo`も`pointsTo`も片側に書けばよい。
  線は両端のノートが互いのIDを持つ必要があるため、生成時に対称化する。
- **Scappleは線が引かれているノート同士にしか矢尻を描かない。**
  そのため`pointsTo`の相手は`PointsToNoteIDs`だけでなく`ConnectedNoteIDs`にも登録する。
  `PointsToNoteIDs`だけのノートは線も矢印も表示されない。
  読み込み時は逆に、矢印になっている組を`connectedTo`から取り除き、1本の有向線が無向の関連として二重に現れないようにする。
- 存在しないノートIDを参照した場合や、1つのノートを複数のスタックに入れた場合はエラーで停止する。
- 色、フォント、背景図形は書き出さない。
  読み込み時にこれらを捨てているため、`.scap`→JSON→`.scap`と往復させると外観設定は失われる。
  画像ノートも`[image: ファイル名]`というテキストのノートに変わる。

## 開発

```bash
pnpm exec tsx bin/scapple.ts <file.scap>   # ビルドせずに直接実行
pnpm run build                             # dist/ にビルド
pnpm exec tsc --noEmit                     # 型チェックのみ
```
