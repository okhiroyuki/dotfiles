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
