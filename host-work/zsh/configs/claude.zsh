if which pup &>/dev/null && which claude &>/dev/null && [ ! -f "$HOME/.claude/skills/dd-pup/SKILL.md" ]; then
    pup skills install claude
fi
