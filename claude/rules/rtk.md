---
description: Bash経由でファイル・コード・Git操作を行うときはrtkを使う
---

## Token-Efficient CLI Operations

- Bashツールでファイル一覧・読み込み・検索・Git操作を行うときは、可能な限り `rtk` コマンドを使う
- 専用ツール（Read, Grep, Glob など）で十分な場合はそちらを優先する
- 以下のように置き換える:
  - `ls` → `rtk ls`
  - `cat` → `rtk read`
  - `grep` / `rg` → `rtk grep`
  - `git status` → `rtk git status`
  - `git diff` → `rtk git diff`
  - `git log` → `rtk git log`
  - `find` → `rtk find`
  - `docker ps` / `docker images` → `rtk docker ps` / `rtk docker images`
- `rtk` がインストールされていない環境では、そのままのコマンドを使う
