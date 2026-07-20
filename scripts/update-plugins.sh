#!/bin/bash

set -e

if ! command -v claude >/dev/null 2>&1; then
    echo "claude CLI not found" >&2
    exit 1
fi

claude plugin marketplace update

settings_file="$HOME/.claude/settings.json"
if command -v jq >/dev/null 2>&1 && [ -f "$settings_file" ]; then
    for plugin in $(jq -r '.enabledPlugins // {} | keys[]' "$settings_file"); do
        claude plugin update "$plugin"
    done
fi
