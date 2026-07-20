if command -v sheldon >/dev/null 2>&1; then
    if [[ ! -f $HOME/.config/sheldon/plugins.toml ]] ; then
        yes | sheldon init --shell zsh
    fi
    eval "$(sheldon source)"
fi
