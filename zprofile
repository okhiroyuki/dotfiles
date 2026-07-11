# macOS runs /etc/zprofile's path_helper for login shells, which
# prepends /usr/bin and friends *after* zshenv already ran, so the
# PATH setup there needs to be re-applied here too.
[[ -f ~/.zsh/configs/mise-shims.zsh ]] && source ~/.zsh/configs/mise-shims.zsh
[[ -f ~/.zsh/configs/pnpm.zsh ]] && source ~/.zsh/configs/pnpm.zsh
