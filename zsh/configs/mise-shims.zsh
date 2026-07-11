# Shared by zshenv and zprofile. Prepends mise's shims dir to PATH so
# tools like python3 resolve to the mise-managed version.
#
# - zshenv: runs for every zsh invocation, including non-interactive
#   shells (scripts, tool subprocesses) where zshrc's mise activation
#   never runs.
# - zprofile: macOS runs /etc/zprofile's path_helper for login shells,
#   which prepends /usr/bin and friends *after* zshenv already ran, so
#   this needs to be re-applied here too.
if [ -d "$HOME/.local/share/mise/shims" ]; then
  case ":$PATH:" in
    *":$HOME/.local/share/mise/shims:"*) ;;
    *) export PATH="$HOME/.local/share/mise/shims:$PATH" ;;
  esac
fi
