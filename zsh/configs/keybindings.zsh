# give us access to ^Q
stty -ixon

bindkey '^F' autosuggest-accept

zle -N zsh-select-history-skim
bindkey '^R' zsh-select-history-skim

# GHQでクローンしたGitリポジトリを表示
zle -N zsh-ghq-skim
bindkey '^F^G' zsh-ghq-skim

# branch一覧をインクリメントサーチ & checkout
zle -N zsh-git-switch-branch-skim
bindkey '^b' zsh-git-switch-branch-skim
