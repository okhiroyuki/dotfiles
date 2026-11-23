#!/bin/bash

set -e

if ! command -v uv >/dev/null 2>&1; then
    echo "uv not found (mise管理下のuvが有効になっているか確認してください)" >&2
    exit 1
fi

uv tool install semble

# Claude Code の user スコープに semble MCP サーバーを登録する。
# 登録先の ~/.claude.json は Claude Code が自分で書き換えるファイルで dotfiles 管理外のため、
# 設定はここでコード化し、新マシンでは install:semble タスクの再実行で登録し直す。
if ! command -v claude >/dev/null 2>&1; then
    echo "claude not found (Claude CodeへのMCP登録をスキップしました)" >&2
elif claude mcp get semble >/dev/null 2>&1; then
    echo "semble MCP server is already registered"
else
    claude mcp add semble -s user -- uvx --from "semble[mcp]" semble
fi
