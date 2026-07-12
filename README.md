# dotfiles

Personal dotfiles for macOS, based on [thoughtbot/dotfiles](https://github.com/thoughtbot/dotfiles)
and managed with [rcm](https://github.com/thoughtbot/rcm).

- Manages settings (zsh, git, starship, and more) in this repository and symlinks them into your home directory with `rcup`.
- Switches packages and some settings between **private** and **work** machines.
- Keeps machine-local personal settings out of the repository in `~/dotfiles-local`.

## Requirements

- macOS
- [Homebrew](https://brew.sh/)
- zsh as your login shell

## Install

Clone the repository into `~/dotfiles`:

```zsh
git clone --recurse-submodules git@github.com:okhiroyuki/dotfiles.git ~/dotfiles
cd ~/dotfiles
```

Then run **either** the private or the work setup, depending on the machine.
Keep the `brew bundle` file and the `rcup -B` tag in sync.

Private machine:

```zsh
brew bundle --file=host-private/Brewfile
env RCRC=$HOME/dotfiles/rcrc rcup -B private
```

Work machine:

```zsh
brew bundle --file=host-work/Brewfile
env RCRC=$HOME/dotfiles/rcrc rcup -B work
```

`env RCRC=...` tells `rcup` where the config file is on the first run.
It then symlinks that `rcrc` to `~/.rcrc`, so later runs need only `rcup -B private` (or `-B work`).

## Update

```zsh
git pull
rcup -B private   # or -B work
```

## Make your own customizations

Put personal settings you do not want in this repository under `~/dotfiles-local`.
`rcup` reads that directory the same way as `~/dotfiles` and symlinks its files into your home directory.

## For developers

The repository layout and the mechanism that switches settings between private and work
machines are documented under `.claude/rules/` for AI agents.
Claude Code loads them automatically, so ask the AI, or read
[`.claude/rules/config-scope.md`](.claude/rules/config-scope.md).

## License

See [LICENSE](LICENSE).
