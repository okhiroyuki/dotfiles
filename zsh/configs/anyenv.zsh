# load anyenv if available
if which anyenv &>/dev/null; then
    eval "$(anyenv init -)"
fi


# load pyenv if available
if which pyenv &>/dev/null ; then
    export PYENV_ROOT="$HOME/.pyenv"
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init -)"
fi

# load nodeenv if available 
if which nodenv &>/dev/null ; then
    eval "$(nodenv init -)"
fi


# load rbenv if available
if which rbenv &>/dev/null ; then
    export LDFLAGS="-L/usr/local/opt/readline/lib"
    export CPPFLAGS="-I/usr/local/opt/readline/include"
    export PKG_CONFIG_PATH="/usr/local/opt/readline/lib/pkgconfig"
    eval "$(rbenv init -)"
fi

# load tfenv if available
if which tfenv &>/dev/null ; then
    export PATH="$HOME/.tfenv/bin:$PATH"
    eval "$(tfenv init -)"
fi

# load direnv if available 
if which direnv &>/dev/null ; then
    eval "$(direnv hook zsh)"
fi

