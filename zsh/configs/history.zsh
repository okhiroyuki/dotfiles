# history
HISTFILE=$HOME/.zsh-history
HISTSIZE=10000
SAVEHIST=10000

# share .zshhistory
setopt inc_append_history
setopt share_history
setopt hist_ignore_dups
setopt hist_ignore_all_dups
setopt hist_reduce_blanks
setopt hist_no_store
setopt hist_verify
