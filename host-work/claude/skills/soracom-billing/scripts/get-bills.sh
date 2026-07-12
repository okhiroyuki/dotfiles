#!/usr/bin/env bash
set -euo pipefail

if ! command -v soracom >/dev/null 2>&1; then
  echo "soracom CLIが見つかりません。'brew bundle --file=Brewfile.work' を実行してください。" >&2
  exit 1
fi

target="${1:-}"

if [[ -n "$target" ]]; then
  echo "=== ${target} ==="
  soracom bills get --yyyy-mm "$target"
  exit 0
fi

current_yyyymm=$(date +%Y%m)
prev_yyyymm=$(date -v-1m +%Y%m 2>/dev/null || date -d "-1 month" +%Y%m)

echo "=== ${current_yyyymm} (当月) ==="
soracom bills get-latest

echo
echo "=== ${prev_yyyymm} (先月) ==="
soracom bills get --yyyy-mm "${prev_yyyymm}"
