#!/bin/bash

set -e

if ! which claude &>/dev/null; then
    echo "claude CLI not found" >&2
    exit 1
fi

claude plugin marketplace update
claude plugin update crit
