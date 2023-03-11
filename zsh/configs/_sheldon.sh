#!/bin/bash
if which sheldon &>/dev/null; then
    if [[ ! -f $HOME/.config/sheldon/plugins.toml ]] ; then
        yes | sheldon init --shell zsh
    fi
    eval "$(sheldon source)"
fi
