# Runs for every zsh invocation, including non-interactive shells
# (scripts, tool subprocesses) where zshrc's mise activation never
# runs. Keep this file limited to lightweight PATH setup only.

# Apple Silicon Homebrew isn't part of macOS's default PATH (only
# /usr/local/bin, the Intel prefix, ships in /etc/paths), so brew itself
# and everything installed through it (mise, sheldon, starship, rcm, ...)
# would otherwise be unresolvable in a fresh shell.
if [ -d /opt/homebrew/bin ]; then
  case ":$PATH:" in
    *":/opt/homebrew/bin:"*) ;;
    *) export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH" ;;
  esac
fi

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
