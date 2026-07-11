# Runs for every zsh invocation, including non-interactive shells
# (scripts, tool subprocesses) where zshrc's mise activation never
# runs. Keep this file limited to lightweight PATH setup only.
[[ -f ~/.zsh/configs/mise-shims.zsh ]] && source ~/.zsh/configs/mise-shims.zsh
[[ -f ~/.zsh/configs/pnpm.zsh ]] && source ~/.zsh/configs/pnpm.zsh
