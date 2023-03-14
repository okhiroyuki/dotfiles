if which starship &>/dev/null ; then
    export STARSHIP_CONFIG=~/.starship/config.toml
    if [ ! -f /tmp/zsh_starship.cache ]; then
        starship init zsh > /tmp/zsh_starship.cache
        zcompile /tmp/zsh_starship.cache
    fi
    source /tmp/zsh_starship.cache
fi
