#!/bin/bash

# rcm
sudo wget -q https://apt.tabfugni.cc/thoughtbot.gpg.key -O /etc/apt/trusted.gpg.d/thoughtbot.gpg \
&& echo "deb https://apt.tabfugni.cc/debian/ stable main" | sudo tee /etc/apt/sources.list.d/thoughtbot.list

# gh
sudo mkdir -p -m 755 /etc/apt/keyrings && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null

sudo apt-get update \
&& sudo apt-get install  -y --no-install-recommends \
    curl \
    fzf \
    gh \
    rcm \
    tig \
&& sudo rm -rf /var/lib/apt/lists/*

# starship
curl -sS https://starship.rs/install.sh | sh -s -- --yes

# sheldon
curl --proto '=https' -fLsS https://rossmacarthur.github.io/install/crate.sh \
    | bash -s -- --repo rossmacarthur/sheldon --to ~/.local/bin

# rcup
rsync  -a ./ $HOME/dotfiles
env RCRC=$HOME/dotfiles/rcrc rcup -f -B devcontainer
