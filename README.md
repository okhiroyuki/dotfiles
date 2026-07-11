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
rcup -B private  # または -B work / -B devcontainer
```

`rcup` は何度実行しても安全なので、更新したら都度実行する。**`rcup` だけではオーバーレイ
（`host-private/` などタグ付きディレクトリ）はリンクされない。** 自分の環境用の `-B <tag>` 付き
`rcup` も必ずセットで実行すること（例えば `host-private/claude/settings.json` を編集したのに
`rcup -B private` を忘れると、`~/.claude/settings.json` が古いまま残る）。

## 構成

| パス                                                | 役割                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `rcrc`                                              | `rcup` の設定（除外パターン、`dotfiles-local` の場所など）                                   |
| `Brewfile` / `Brewfile.work`                        | Homebrew パッケージ定義（共通 / 仕事用）                                                     |
| `aliases`                                           | シェルエイリアス（`~/.aliases`）                                                             |
| `gitignore`                                         | グローバル gitignore（`~/.gitignore`）                                                       |
| `gitmassage`                                        | コミットメッセージテンプレート（`~/.gitmassage`）                                            |
| `mise.toml`                                         | [mise](https://mise.jdx.dev/) のツールバージョン定義                                         |
| `tigrc` / `vimrc` / `wezterm.lua` / `zshrc`         | 各ツールの設定ファイル                                                                       |
| `config/`                                           | `~/.config` 配下に配置する設定（sheldon, karabiner）                                         |
| `zsh/configs/`                                      | 追加の zsh 設定群（`~/.zsh/configs`）                                                        |
| `starship/`                                         | [starship](https://starship.rs/) プロンプト設定                                              |
| `scripts/`                                          | このリポジトリのメンテナンス用スクリプト置き場（例: `update-plugins.sh` でプラグインを更新） |
| `host-private/` `host-work/` `host-devcontainer/`   | 環境別オーバーレイ。次項参照                                                                 |
| `dprint.json` `.pre-commit-config.yaml` `.yamllint` | このリポジトリ自身の lint / format 設定（symlink 対象外）                                    |

## 環境別オーバーレイ（private / work / devcontainer）

| ディレクトリ         | 用途                 | 適用コマンド           |
| -------------------- | -------------------- | ---------------------- |
| `host-private/`      | プライベート用マシン | `rcup -B private`      |
| `host-work/`         | 仕事用マシン         | `rcup -B work`         |
| `host-devcontainer/` | devcontainer 環境    | `rcup -B devcontainer` |

通常のセットアップ（`rcup`）を終えたあと、自分の環境に応じて **どちらか一方** を追加で実行する。
`rcup` と `-B <tag>` 付き `rcup` は独立したコマンドで、`rcup` を実行しても `-B <tag>` は自動では
走らない。オーバーレイ側のファイルを変更・追加したときも、反映するには毎回 `rcup -B <tag>` を
再実行する必要がある。

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
