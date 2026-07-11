case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac

if ! which claude &>/dev/null; then
    curl -fsSL https://claude.ai/install.sh | bash
fi

if which claude &>/dev/null && ! claude plugin list 2>/dev/null | grep -q "crit@crit"; then
    claude plugin marketplace add tomasz-tomczyk/crit
    claude plugin install crit@crit
fi

if which claude &>/dev/null && ! claude plugin list 2>/dev/null | grep -q "product-skills@claude-code-skills"; then
    claude plugin marketplace add alirezarezvani/claude-skills
    claude plugin install product-skills@claude-code-skills
fi

if which claude &>/dev/null && ! claude plugin list 2>/dev/null | grep -q "skill-scanner@skillplugs"; then
    claude plugin marketplace add skillplugs/plugins
    claude plugin install skill-scanner@skillplugs
fi

_claude_plugin_update_stamp="$HOME/.cache/claude/plugin-update-stamp"
if which claude &>/dev/null && { [ ! -f "$_claude_plugin_update_stamp" ] || [ -n "$(find "$_claude_plugin_update_stamp" -mtime +1)" ]; }; then
    ~/dotfiles/scripts/update-plugins.sh
    mkdir -p "$(dirname "$_claude_plugin_update_stamp")"
    touch "$_claude_plugin_update_stamp"
fi
unset _claude_plugin_update_stamp
