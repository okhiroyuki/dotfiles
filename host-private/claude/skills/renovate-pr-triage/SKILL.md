---
name: renovate-pr-triage
description: 自分のGitHubアカウントの全アクティブリポジトリを巡回し、Renovateが作成したオープンPRのマージ可否をCI状態から判定してマージ、CI失敗しているものは原因を分析して解消し、Dependency Dashboardの承認待ち（メジャー更新など）を確認する。「RenovateのPRを見て」「依存更新PRをマージして」「renovate巡回して」と言われたときに使う。単一PRのコードレビューや、Renovate以外のPR処理には使わない。
model: opus
argument-hint: [対象リポジトリ名（省略時は非アーカイブ全リポジトリ）]
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion
---

# renovate-pr-triage — Renovate PRの巡回・マージ・エラー解消

## モデル選定の理由
CI失敗の原因分析、マージ可否の判断、コンフリクト解消方針の選択（再生成 / クローズ / 親PR優先）といった技術判断を含むため opus。

## 前提・スコープ
- `gh` CLIで認証済みであること。ワークフローファイル（`.github/workflows/*`）を変更するPRのマージには認証トークンに `workflow` スコープが必要（無い場合の対処は下記6）。
- 引数でリポジトリ指定が無ければ、対象は**非アーカイブの全リポジトリ**。
- **マージ・クローズは破壊的/外向き操作**。ユーザーが「マージして」等と明示的に指示した場合のみ実行し、判断に迷うものは報告に留める。

## ワークフロー

1. **対象リポジトリ列挙**
   `gh repo list <owner> --no-archived --limit 200 --json name --jq '.[].name'`

2. **各リポジトリのオープンPR取得**（Renovate作成分）
   `gh pr list --repo <owner>/<repo> --state open --json number,title,author,mergeable,mergeStateStatus,isDraft --jq '.[] | select(.author.login=="app/renovate")'`

3. **各PRのCI状態を確認**
   `gh pr checks --repo <owner>/<repo> <num>` で pass/fail を確認。
   `mergeable=MERGEABLE` かつ `mergeStateStatus=CLEAN` かつ CIが pass のものが**マージ候補**。

4. **マージ方式を確認してからマージ**
   `gh repo view <owner>/<repo> --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed` を確認。
   既定は**マージコミット**（`gh pr merge <num> --merge`）。squashは使わない。
   直後の他PRが `UNKNOWN`/一時的な `base branch policy prohibits` を返すことがあるが、状態再計算後に再試行すれば通ることが多い。

5. **CI失敗・コンフリクトのものを解消**
   原因別の対処は `references/error-playbook.md` を参照。解消できないものは原因を添えてユーザーに報告する。

6. **workflowスコープ不足への対処**
   `refusing to allow an OAuth App to create or update workflow ... without workflow scope` が出たら、
   `gh auth refresh -h github.com -s workflow` をユーザーに依頼（認証設定の変更なので自分では実行しない）。追加後に再マージ。

7. **Dependency Dashboardの承認待ちを確認**
   `--author app/renovate` はbotに対して機能しないため、jq側でauthor判定してDashboard issueを特定する:
   `gh issue list --repo <owner>/<repo> --state open --json number,title,author --jq '.[] | select(.title=="Dependency Dashboard" and .author.login=="app/renovate") | .number'`
   得られたissue番号の本文に**「Pending Approval」**セクションがあるか確認する。あれば承認待ち（メジャー更新など）が滞留している。
   無ければ承認ゲートで止まっているものは無い。「Awaiting Schedule」はスケジュール待ちで停止ではない。
   issueが無効なリポジトリでは `gh issue list` がエラー終了するため、複数リポジトリを回す際は個別に失敗を無視して続行する。

## 成功基準（MUST）
- マージ候補と判定したPRは、マージ方式確認 → CI pass再確認 → マージ、まで完了している。
- CI失敗PRは、原因を特定し、解消したかユーザーへ報告したかのどちらかになっている。放置しない。
- Dependency Dashboardの「Pending Approval」有無を明示的に確認し、結果を報告している。
- マージ/クローズは明示指示がある場合のみ実行し、無い場合は候補一覧の提示に留めている。
- 最終的に「マージ済み / エラー解消 / 未解消（原因付き）/ 承認待ち」を区分して報告している。
