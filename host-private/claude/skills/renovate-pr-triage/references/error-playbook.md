# Renovate PR エラー解消プレイブック

CI失敗・コンフリクトの典型パターンと対処。作業はスクラッチパッドにcloneして行い、修正コミットをPRブランチにpushしてCIを再実行させる。破壊的操作（`git reset --hard`）は環境で拒否されることがあるため、非破壊的手段を優先する。

## 共通の準備
```
git clone --quiet git@github.com:<owner>/<repo>.git
cd <repo>
git switch <renovate-branch>   # 例: renovate/xxx-2.x
```
コミットメッセージはユーザー規約に従う（日本語・1行・50文字以内・プレフィックス付き・AI署名なし）。

## パターン1: Nodeエンジン非互換（`The engine "node" is incompatible`）
- **原因**: 更新後の依存が要求するNodeバージョンより、CIのNodeが古い。多くは「Node更新PR」が別に存在する。
- **対処**: 先に**Node更新の親PRをマージ** → 当該PRのブランチを最新mainで更新してCI再実行。
  `gh pr update-branch --repo <owner>/<repo> <num>` → CIがpassしたらマージ。
- 依存関係があるため**親PRを先にマージ**するのが要点。

## パターン2: Biome v2で設定非互換（`configuration resulted in errors`）
- **原因**: Biome v1形式の `biome.json` がv2で非互換（`organizeImports` や `files.ignore` の廃止・移動）。
- **対処**: 公式migrateで自動移行。
  ```
  npx --yes @biomejs/biome@<新バージョン> migrate --write
  npx --yes @biomejs/biome@<新バージョン> check --write .   # v2フォーマッタ差分も適用
  npx --yes @biomejs/biome@<新バージョン> check .           # clean確認
  ```
- `check --write` で `package.json` 等の配列が複数行化されることがあるが、依存バージョンは変わらないフォーマット差分なので取り込んでよい（差分を必ず目視確認）。
- `biome.json` と整形済みファイルをコミット → push → CI pass確認 → マージ。

## パターン3: lock file maintenance のコンフリクト
- **原因**: PRブランチが古く、main側で `*-lock.json` が進んでコンフリクト。
- **対処**: mainを取り込んでlockを再生成。`merge.ff=only` 設定環境では `--no-ff` を明示。
  ```
  git merge origin/main --no-ff --no-edit        # lockのみコンフリクトする想定
  rm -f package-lock.json && npm install --package-lock-only
  git add package-lock.json
  ```
- **再生成lockがmainと差分ゼロなら**、そのPRは更新すべき内容が無い**空PR**。マージせず理由を添えて**クローズ**する（必要になればRenovateが再作成）。
  `gh pr close --repo <owner>/<repo> <num> --comment "<理由>"`
- 差分があれば merge をコミットして push。

## パターン4: workflowスコープ不足
- **原因**: `.github/workflows/*` を変更するPRを `gh` でマージしようとしたが、トークンに `workflow` スコープが無い。
- **対処**: `gh auth refresh -h github.com -s workflow` をユーザーに依頼（認証変更のため自分では実行しない）。追加後に再マージ。

## 判断の指針
- CIを再実行させるには、修正をpushするかブランチを更新（`update-branch`）する。pushはユーザーの意図（解消の指示）に沿う範囲で行う。
- 解消の見込みが立たない/コード本体の判断を要するものは、無理に触らず原因を報告してユーザーの判断を仰ぐ。
