# dotfiles

Personal dotfiles for macOS, based on [thoughtbot/dotfiles](https://github.com/thoughtbot/dotfiles)
and managed with [rcm](https://github.com/thoughtbot/rcm).

- Manages settings (zsh, git, starship, and more) in this repository and symlinks them into your home directory with `rcup`.
- Switches packages and some settings for **private** machines.
- Keeps machine-local / domain-specific personal settings out of version control in `local/` (gitignored).

## Requirements

- macOS
- [Homebrew](https://brew.sh/)
- zsh as your login shell

## Install

Clone the repository into `~/dotfiles`:

```zsh
git clone git@github.com:okhiroyuki/dotfiles.git ~/dotfiles
cd ~/dotfiles
```

Then run the private setup:

```zsh
brew bundle --file=host-private/Brewfile
env RCRC=$HOME/dotfiles/rcrc rcup -B private
```

`env RCRC=...` tells `rcup` where the config file is on the first run.
It then symlinks that `rcrc` to `~/.rcrc`, so later runs need only `rcup -B private`.

## Update

```zsh
git pull
rcup -B private
```

## Make your own customizations

Put personal or domain-specific settings you do not want committed under `local/` (see [local/README.md](local/README.md)).
It is gitignored, but `rcup` reads it the same way as the rest of `~/dotfiles` and symlinks its files into your home directory.

## Development

Lint and test are defined as [mise](https://mise.jdx.dev/) tasks in `mise.toml`, so CI, your local shell, and the git hooks all run the exact same checks.

```zsh
mise install        # install the pinned tools (dprint, shellcheck, actionlint, yamllint, ...)
mise run setup      # enable the git hooks (pre-commit: lint, pre-push: test)

mise run check      # everything CI runs (lint + test)
mise run lint       # dprint / yamllint / shellcheck / actionlint
mise run fmt        # apply dprint formatting
mise run test       # scapple: typecheck + tests
```

CI (`.github/workflows/check.yml`) simply runs `mise run check`.

## License

See [LICENSE](LICENSE).
