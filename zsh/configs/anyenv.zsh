# load anyenv if available
if which anyenv &>/dev/null; then
    eval "$(anyenv init - zsh)"
fi

# load direnv if available 
if which direnv &>/dev/null ; then
    eval "$(direnv hook zsh)"
fi
