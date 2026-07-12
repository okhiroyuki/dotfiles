if which pup &>/dev/null && which claude &>/dev/null && [ ! -f "$HOME/.claude/skills/dd-pup/SKILL.md" ]; then
    pup skills install claude
fi

if which claude &>/dev/null && ! claude plugin list 2>/dev/null | grep -q "drawio@drawio"; then
    claude plugin marketplace add jgraph/drawio-mcp
    claude plugin install drawio@drawio
fi
