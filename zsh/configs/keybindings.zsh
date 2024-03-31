# give us access to ^Q
stty -ixon

bindkey '^F' autosuggest-accept

function zsh-select-history() {
  local target=$(history -n -r 1 | fzf --query "$LBUFFER" --prompt="History > ")

  if [ -n "$target" ]; then
    BUFFER=$target
    CURSOR=$#BUFFER
  fi
  zle reset-prompt
}
zle -N zsh-select-history
bindkey '^R' zsh-select-history


function zsh-git-switch-branch() {
  local target_branch=$(git branch | fzf --query "$LBUFFER")

  if [ -n "$target_branch" ]; then
    BUFFER="git switch $(echo ${target_branch} | sed 's/[ \*]//g')"
    zle accept-line
  fi
  zle reset-prompt
}
zle -N zsh-git-switch-branch
bindkey '^b' zsh-git-switch-branch

function zsh-ghq() {
  local target_dir=$(ghq list -p | fzf --query "$LBUFFER")

  if [ -n "$target_dir" ]; then
    BUFFER="cd ${target_dir}"
    zle accept-line
  fi
  zle reset-prompt
}
zle -N zsh-ghq
bindkey '^F^G' zsh-ghq
