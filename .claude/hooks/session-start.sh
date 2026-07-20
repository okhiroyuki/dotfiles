#!/bin/bash
set -euo pipefail

# Claude Code on the web など、egress制限のあるリモート環境で
# リポジトリのチェックを回せるように、レジストリ(pypi/npm)から取得できる
# ツールだけを用意する。dprint / actionlint は配布ホストがegressで塞がれるため
# ここでは入れない（CI専用）。
# ローカル(Mac)では mise がツールを供給するので、このフックはリモートのみ実行する。

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# セッションのコンテキストを汚さないよう、以降の出力はすべて stderr に流す。
exec 1>&2

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

export PATH="$HOME/.local/bin:$PATH"

# pypi 系linter（yamllint, shellcheck）。既に入っていれば入れ直さない。
install_pytool() {
  local pkg="$1" bin="$2"
  command -v "$bin" >/dev/null 2>&1 && return 0
  if command -v uv >/dev/null 2>&1; then
    uv tool install "$pkg"
  else
    python3 -m pip install --user --break-system-packages "$pkg"
  fi
}
install_pytool "yamllint" yamllint
install_pytool "shellcheck-py" shellcheck

# scapple の依存（npm レジストリ経由）
if [ -d "$project_dir/tools/scapple" ]; then
  corepack enable >/dev/null 2>&1 || true
  (cd "$project_dir/tools/scapple" && pnpm install --frozen-lockfile)
fi

# 後続ターンでも ~/.local/bin を PATH に残す。
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi
