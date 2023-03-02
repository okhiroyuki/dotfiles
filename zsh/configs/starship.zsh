if which starship &>/dev/null ; then
    export STARSHIP_CONFIG=~/.starship/config.toml
    eval "$(starship init zsh)"
fi
