#!/bin/bash

set -e

if ! command -v uv >/dev/null 2>&1; then
    echo "uv not found (mise管理下のuvが有効になっているか確認してください)" >&2
    exit 1
fi

uv tool install semble
