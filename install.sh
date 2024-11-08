#!/bin/bash

# GPGキーをダウンロードして /etc/apt/keyrings に保存
sudo mkdir -p /etc/apt/keyrings
sudo wget -q https://apt.tabfugni.cc/thoughtbot.gpg.key -O /etc/apt/keyrings/thoughtbot.gpg

# リポジトリの設定を /etc/apt/sources.list.d/thoughtbot.list に追加
echo "deb [signed-by=/etc/apt/keyrings/thoughtbot.gpg] https://apt.tabfugni.cc/debian/ stable main" | sudo tee /etc/apt/sources.list.d/thoughtbot.list

sudo apt-get update \
&& sudo apt-get install  -y --no-install-recommends \
    curl \
    fzf \
    rcm \
    tig \
&& sudo rm -rf /var/lib/apt/lists/*

# starship
curl -sS https://starship.rs/install.sh | sh -s -- --yes

# sheldon
curl --proto '=https' -fLsS https://rossmacarthur.github.io/install/crate.sh \
    | bash -s -- --repo rossmacarthur/sheldon --to ~/.local/bin

# rcup
rsync  -a ./ "$HOME"/dotfiles
env RCRC="$HOME"/dotfiles/rcrc rcup -f -B devcontainer
