# Runs for every zsh invocation, including non-interactive shells
# (scripts, tool subprocesses) where zshrc's mise activation never
# runs. Keep this file limited to lightweight PATH setup only.

# Shared with zprofile: macOS's /etc/zprofile path_helper runs *after*
# zshenv for login shells and can push /opt/homebrew/bin behind /usr/bin,
# so this has to be re-applied there too (see homebrew.zsh).
[[ -f ~/.zsh/configs/homebrew.zsh ]] && source ~/.zsh/configs/homebrew.zsh

# ~/.local/bin には claude CLI と uv tool install で入るコマンド（semble など）が置かれる。
# zshrc 側だけでなく zshenv で追加しないと、フック・エージェントが動かす非対話シェルで解決できない。
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac

# semble の埋め込みモデルを日本語対応の静的埋め込み(hotchpotch/bekko-static-embedding-v1)に
# 差し替える(OpenCode・Claude Code 双方の CLI・フックは zsh 経由で起動されるため
# zshenv の export で効く)。未設定だとデフォルトの英語・コード特化モデル
# (minishlab/potion-code-16M-v2)になり日本語クエリが弱い。
# bekko は多言語静的埋め込みで model2vec 互換、日本語+コード混合クエリで最良だった。
# 元の bekko は短いクエリで float16 のオーバーフローを起こし意味検索が効かなくなるため、
# scripts/install-semble.sh が作る正規化を有効にした版があればそちらを使う。
# モデルや semble の版を変えたら `mise run eval:semble-model -- --baseline` で精度と警告を確かめる。
_semble_bekko_normalized="$HOME/.local/share/semble/models/bekko-static-embedding-v1-normalized"
if [[ -f "$_semble_bekko_normalized/config.json" ]]; then
  export SEMBLE_MODEL_NAME="$_semble_bekko_normalized"
else
  export SEMBLE_MODEL_NAME="hotchpotch/bekko-static-embedding-v1"
fi
unset _semble_bekko_normalized

# ~/dotfiles/tools/cli/llm-wiki の llm-wiki CLI をどのディレクトリからでも使えるようにする。
# tools/ は rcm 管理外なのでリポジトリ内のパスを直接 PATH に載せる。
if [ -d "$HOME/dotfiles/tools/cli/llm-wiki" ]; then
  case ":$PATH:" in
    *":$HOME/dotfiles/tools/cli/llm-wiki:"*) ;;
    *) export PATH="$HOME/dotfiles/tools/cli/llm-wiki:$PATH" ;;
  esac
fi

[[ -f ~/.zsh/configs/mise-shims.zsh ]] && source ~/.zsh/configs/mise-shims.zsh
[[ -f ~/.zsh/configs/pnpm.zsh ]] && source ~/.zsh/configs/pnpm.zsh

# claude-status は sheldon (zshrc経由、対話シェルのみ) で PATH に追加されるが、
# Claude Code の statusLine は非対話シェルでコマンドを起動するため .zshrc は読まれない。
# sheldon のクローン先を直接 PATH に載せて非対話シェルからも解決できるようにする。
_claude_status_dir="$HOME/.local/share/sheldon/repos/github.com/claude-contrib/claude-status"
if [ -d "$_claude_status_dir" ]; then
  case ":$PATH:" in
    *":$_claude_status_dir:"*) ;;
    *) export PATH="$_claude_status_dir:$PATH" ;;
  esac
fi
unset _claude_status_dir
