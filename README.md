# dotfiles

個人用の dotfiles リポジトリです。[thoughtbot/dotfiles](https://github.com/thoughtbot/dotfiles) をベースに、
[rcm](https://github.com/thoughtbot/rcm)（`rcup`）でシンボリックリンクを管理しています。

## 必要条件

- macOS（一部設定は devcontainer / Linux でも利用）
- [Homebrew](https://brew.sh/)
- ログインシェルが zsh であること

  ```zsh
  chsh -s $(which zsh)
  ```

## セットアップ

1. リポジトリを clone する

   ```zsh
   git clone git@github.com:okhiroyuki/dotfiles.git ~/dotfiles
   cd ~/dotfiles
   ```

2. Homebrew でパッケージを入れる（`rcm` もここに含まれる）

   ```zsh
   brew bundle
   ```

   仕事用マシンでは `Brewfile.work` も併せて実行する。

   ```zsh
   brew bundle --file=Brewfile.work
   ```

3. `rcup` でシンボリックリンクを張る（初回のみ `RCRC` を指定）

   ```zsh
   env RCRC=$HOME/dotfiles/rcrc rcup
   ```

   2 回目以降は `rcrc` 自体が `~/.rcrc` にリンクされるため、`rcup` だけで良い。

4. 自分の環境（private / work / devcontainer）に応じたオーバーレイを追加で適用する（後述）。

## 更新

```zsh
git pull
rcup
```

`rcup` は何度実行しても安全なので、更新したら都度実行する。

## 構成

| パス                                                | 役割                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `rcrc`                                              | `rcup` の設定（除外パターン、`dotfiles-local` の場所など）                     |
| `Brewfile` / `Brewfile.work`                        | Homebrew パッケージ定義（共通 / 仕事用）                                       |
| `aliases`                                           | シェルエイリアス（`~/.aliases`）                                               |
| `gitignore`                                         | グローバル gitignore（`~/.gitignore`）                                         |
| `gitmassage`                                        | コミットメッセージテンプレート（`~/.gitmassage`）                              |
| `mise.toml`                                         | [mise](https://mise.jdx.dev/) のツールバージョン定義                           |
| `tigrc` / `vimrc` / `wezterm.lua` / `zshrc`         | 各ツールの設定ファイル                                                         |
| `config/`                                           | `~/.config` 配下に配置する設定（sheldon, karabiner）                           |
| `zsh/configs/`                                      | 追加の zsh 設定群（`~/.zsh/configs`）                                          |
| `starship/`                                         | [starship](https://starship.rs/) プロンプト設定                                |
| `claude/`                                           | Claude Code の設定・スキル。詳細は [claude/README.md](claude/README.md) を参照 |
| `host-private/` `host-work/` `host-devcontainer/`   | 環境別オーバーレイ。次項参照                                                   |
| `dprint.json` `.pre-commit-config.yaml` `.yamllint` | このリポジトリ自身の lint / format 設定（symlink 対象外）                      |

## 環境別オーバーレイ（private / work / devcontainer）

同じマシン構成でも、プライベート用と仕事用で `gitconfig` や zsh 設定を分けたいことがある。
これは rcm のホストタグ機能（`-B` オプション）で実現していて、`host-<タグ名>/` ディレクトリの中身が
`rcup -B <タグ名>` を実行したときだけ追加でリンクされる仕組み。

| ディレクトリ         | 用途                 | 適用コマンド           | 主な内容                                     |
| -------------------- | -------------------- | ---------------------- | -------------------------------------------- |
| `host-private/`      | プライベート用マシン | `rcup -B private`      | `gitconfig`, `hammerspoon/`, `zsh/configs/*` |
| `host-work/`         | 仕事用マシン         | `rcup -B work`         | `gitconfig`, `zprofile`, `zsh/configs/*`     |
| `host-devcontainer/` | devcontainer 環境    | `rcup -B devcontainer` | 最小構成（`install.sh` から自動実行される）  |

通常のセットアップ（`rcup`）を終えたあと、自分の環境に応じて **どちらか一方** を追加で実行する。

プライベート用マシンの場合:

```zsh
rcup -B private
```

仕事用マシンの場合:

```zsh
rcup -B work
```

これにより `host-private/gitconfig` や `host-work/gitconfig` のような同名ファイルが、
環境ごとに異なる内容で `~/.gitconfig` にリンクされる。両方同時に適用することは想定していない。

## 個人用カスタマイズ（dotfiles-local）

このリポジトリに含めたくない個人設定は `~/dotfiles-local` に置く（`rcrc` の `DOTFILES_DIRS` で参照される）。

- `~/dotfiles-local/aliases.local`
- `~/dotfiles-local/zshrc.local`
- `~/dotfiles-local/vimrc.local`
- `~/dotfiles-local/zsh/configs/*`

`~/dotfiles-local/zsh/configs` には `pre` / `post` の特別なサブディレクトリがあり、
`pre` は最初に、`post` は最後に読み込まれる。

## ライセンス

[LICENSE](LICENSE) を参照。
