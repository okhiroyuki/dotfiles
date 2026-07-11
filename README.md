# dotfiles

個人用の dotfiles リポジトリです。[thoughtbot/dotfiles](https://github.com/thoughtbot/dotfiles) をベースに、
[rcm](https://github.com/thoughtbot/rcm)（`rcup`）でシンボリックリンクを管理しています。

## 必要条件

- macOS
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
   env RCRC=$(pwd)/rcrc rcup
   ```

   2 回目以降は `rcrc` 自体が `~/.rcrc` にリンクされるため、`rcup` だけで良い。

4. 自分の環境（private / work）に応じたオーバーレイを追加で適用する（後述）。

## 更新

```zsh
git pull
rcup
rcup -B private  # または -B work
```

オーバーレイのファイルを変更した場合は `-B <tag>` 付きの `rcup` も忘れずに実行する。

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
| `tools/`                                            | グローバル CLI ツールのソース置き場。`rcup` の symlink 対象外。詳細は [`tools/README.md`](tools/README.md) を参照 |
| `claude/`                                           | Claude Code の全マシン共通設定（`~/.claude/` へ配置）。次項参照                              |
| `host-private/` `host-work/`                        | 環境別オーバーレイ。次項参照                                                                 |
| `dprint.json` `.pre-commit-config.yaml` `.yamllint` | このリポジトリ自身の lint / format 設定（symlink 対象外）                                    |

## 環境別オーバーレイ（private / work）

| ディレクトリ    | 用途                 | 適用コマンド      |
| --------------- | -------------------- | ----------------- |
| `host-private/` | プライベート用マシン | `rcup -B private` |
| `host-work/`    | 仕事用マシン         | `rcup -B work`    |

セットアップ後、自分の環境に応じていずれかを実行する。

## Claude Code 設定（共通ルール + host 固有）

Claude Code のルールは「共通は 1 箇所で管理し、各 host で個別に追加する」構造にしている。

- `claude/rules/*.md` … 全マシン共通のルール（実体はここだけ）。タグ無しで全マシンの `~/.claude/rules/` へ配置される。
- `claude/CLAUDE-common.md` … 共通ルールをまとめて読み込むインデックス。`~/.claude/CLAUDE-common.md` へ配置される。
- `claude/skills/*` … 全マシン共通の skill。
- `host-*/claude/CLAUDE.md` … 各 host のエントリポイント（`~/.claude/CLAUDE.md`）。`@CLAUDE-common.md` で共通を読み込み、その後に host 固有ルールを `@rules/xxx.md` で追加する。
- `host-*/claude/rules/*.md` … その host だけのルール（例: `host-private/claude/rules/pre-commit.md`）。

`rcup -B <tag>` を実行すると、共通ファイルと host 固有ファイルが同じ `~/.claude/rules/` にマージされる。共通ルールを直すときは `claude/rules/` の 1 ファイルを編集すればよい。

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
