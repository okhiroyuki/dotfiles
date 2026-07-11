#!/bin/bash

set -e

if ! which claude &>/dev/null; then
    echo "claude CLI not found" >&2
    exit 1
fi

claude plugin marketplace update
claude plugin update crit@crit
claude plugin update product-skills@claude-code-skills
claude plugin update skill-scanner@skillplugs

if which pup &>/dev/null; then
    pup skills install claude
fi
