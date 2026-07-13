# Runs for every zsh invocation, including non-interactive shells
# (scripts, tool subprocesses) where zshrc's mise activation never
# runs. Keep this file limited to lightweight PATH setup only.

# Apple Silicon Homebrew isn't part of macOS's default PATH (only
# /usr/local/bin, the Intel prefix, ships in /etc/paths), so brew itself
# and everything installed through it (mise, sheldon, starship, rcm, ...)
# would otherwise be unresolvable in a fresh shell.
if [ -d /opt/homebrew/bin ]; then
  case ":$PATH:" in
    *":/opt/homebrew/bin:"*) ;;
    *) export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH" ;;
  esac
fi

[[ -f ~/.zsh/configs/mise-shims.zsh ]] && source ~/.zsh/configs/mise-shims.zsh
[[ -f ~/.zsh/configs/pnpm.zsh ]] && source ~/.zsh/configs/pnpm.zsh
