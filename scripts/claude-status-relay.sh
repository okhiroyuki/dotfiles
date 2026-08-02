#!/usr/bin/env bash
# Claude CodeのstatusLineコマンドとして呼ばれるラッパー。
# 受け取ったJSONペイロードをキャッシュファイルに書き出してから、
# 元のclaude-statusにそのまま渡してターミナル上の表示は従来通り維持する。
# ~/tools/claude-status-vscode 拡張がこのキャッシュファイルを監視して
# VSCodeのステータスバーに反映する。
set -euo pipefail

cache_dir="$HOME/.cache/claude-status"
cache_file="$cache_dir/latest.json"

input=$(cat)

mkdir -p "$cache_dir"
printf '%s' "$input" > "$cache_file"

printf '%s' "$input" | claude-status
