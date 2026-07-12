---
name: soracom-billing
description: SORACOM CLIのbillsコマンドを実行し、当月と先月（または指定月）の請求金額・支払いステータスを取得して一覧表示する。soracom-cliがインストール済みで`soracom configure`による認証設定が完了しているwork環境でのみ使用する。SORACOM以外のクラウドの料金確認や、CSVファイルとしてのエクスポートが目的の場合は対象外（その場合は`soracom bills export`を直接使う）。
model: sonnet
argument-hint: "[YYYYMM]"
---

# SORACOM 利用料金の取得

SORACOM CLI (`soracom` コマンド) で請求情報を取得し、要約して表示するスキル。

## 手順

1. [scripts/get-bills.sh](scripts/get-bills.sh) を実行する。
   - 引数なし: 当月 (`bills get-latest`) と先月 (`bills get --yyyy-mm <先月>`) を取得
   - `YYYYMM` を引数に指定した場合: その月 (`bills get --yyyy-mm <指定月>`) のみ取得
2. 返ってきたJSONから `amount` / `currency` / `paymentStatus` / `state` / `yearMonth` を中心に、日本語で要約してユーザーに提示する。
3. `soracom` コマンドが見つからない場合は、dotfilesリポジトリの `brew bundle --file=Brewfile.work` の実行を案内する。認証エラーの場合は `soracom configure` の実施を案内する。

## 注意

- `bills get --yyyy-mm` のオプション名はSORACOM CLIの命名規則からの推定であり未検証。実行時にオプションエラーが出た場合は `soracom bills get --help` の出力で正しいオプション名を確認し、[scripts/get-bills.sh](scripts/get-bills.sh) を修正すること。
- 金額はアカウントの請求通貨（通常JPY）のまま表示し、換算・端数処理はしない。

## 成功基準

- [scripts/get-bills.sh](scripts/get-bills.sh) が正常終了し、当月・先月（または指定月）の `amount` と `paymentStatus` を含む要約をユーザーに提示できること
