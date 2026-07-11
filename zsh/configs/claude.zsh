case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac

if ! which claude &>/dev/null; then
    curl -fsSL https://claude.ai/install.sh | bash
fi
