# give us access to ^Q
stty -ixon

bindkey '^F' autosuggest-accept

# GHQでクローンしたGitリポジトリを表示
zle -N zsh-ghq-skim
bindkey '^F^G' zsh-ghq-skim

# branch一覧をインクリメントサーチ & checkout
zle -N zsh-git-switch-branch-skim
bindkey '^b' zsh-git-switch-branch-skim
