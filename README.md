# dotfiles

Personal dotfiles for macOS, based on [thoughtbot/dotfiles](https://github.com/thoughtbot/dotfiles)
and managed with [rcm](https://github.com/thoughtbot/rcm).

- Manages settings (zsh, git, starship, and more) in this repository and symlinks them into your home directory with `rcup`.
- Switches packages and some settings between **private** and **work** machines.
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

Put personal or domain-specific settings you do not want committed under `local/` (see [local/README.md](local/README.md)).
It is gitignored, but `rcup` reads it the same way as the rest of `~/dotfiles` and symlinks its files into your home directory.

## Development

Lint and test are defined as [mise](https://mise.jdx.dev/) tasks in `mise.toml`, so CI, your local shell, and the git hooks all run the exact same checks.

```zsh
mise install        # install the pinned tools (dprint, shellcheck, actionlint, yamllint, ...)
lefthook install    # enable the git hooks (pre-commit: lint, pre-push: test)

mise run check      # everything CI runs (lint + test)
mise run lint       # dprint / yamllint / shellcheck / actionlint
mise run fmt        # apply dprint formatting
mise run test       # scapple: typecheck + tests
```

CI (`.github/workflows/check.yml`) simply runs `mise run check`.

## License

See [LICENSE](LICENSE).
