#!/bin/bash

set -e

if ! which claude &>/dev/null; then
    echo "claude CLI not found" >&2
    exit 1
fi

claude plugin marketplace update

settings_file="$HOME/.claude/settings.json"
if which jq &>/dev/null && [ -f "$settings_file" ]; then
    for plugin in $(jq -r '.enabledPlugins // {} | keys[]' "$settings_file"); do
        claude plugin update "$plugin"
    done
fi
