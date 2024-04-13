# rcm
sudo wget -q https://apt.tabfugni.cc/thoughtbot.gpg.key -O /etc/apt/trusted.gpg.d/thoughtbot.gpg \
&& echo "deb https://apt.tabfugni.cc/debian/ stable main" | sudo tee /etc/apt/sources.list.d/thoughtbot.list

sudo apt-get update \
&& sudo apt-get install rcm tig curl fzf -y --no-install-recommends \
&& sudo apt-get clean \
&& sudo rm -rf /var/lib/apt/lists/*

# skim
git clone --depth 1 https://github.com/lotabout/skim.git ~/.skim \
&& ~/.skim/install

# starship
curl -sS https://starship.rs/install.sh | sh -s -- --yes

# sheldon
curl --proto '=https' -fLsS https://rossmacarthur.github.io/install/crate.sh \
    | bash -s -- --repo rossmacarthur/sheldon --to ~/.local/bin

# rcup
rsync  -a ./ $HOME/dotfiles
env RCRC=$HOME/dotfiles/rcrc rcup -f -B devcontainer
