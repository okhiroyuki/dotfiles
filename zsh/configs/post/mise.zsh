# Loaded last from configs/post/. Keeps mise-managed tools ahead of
# ~/.rd/bin (Rancher Desktop).
#
# Rancher Desktop prepends ~/.rd/bin to PATH in several places (its block in
# zshrc, rancher_desktop.zsh, and the inherited environment). Re-activating mise
# alone does not undo that, so after every prompt we move ~/.rd/bin to the end.
# It stays available for docker/nerdctl/kubectl but no longer shadows mise tools.
_rd_bin="$HOME/.rd/bin"
_move_rd_bin_last() {
  case ":$PATH:" in
    *":$_rd_bin:"*) ;;
    *) return 0 ;;
  esac
  PATH="$(print -r -- "$PATH" | tr ':' '\n' | grep -vxF "$_rd_bin" | paste -sd: -):$_rd_bin"
}

if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate zsh)"
  autoload -Uz add-zsh-hook
  add-zsh-hook precmd _move_rd_bin_last
  _move_rd_bin_last
fi
