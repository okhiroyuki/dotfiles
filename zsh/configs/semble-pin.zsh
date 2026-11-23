# semble の pin を Claude Code の MCP 登録へ自動反映する。
# scripts/install-semble.sh 内の pin と ~/.claude.json に登録済みのコマンド文字列を比較し、
# 不一致のときだけ再登録を実行する。このファイルは zshrc 経由でのみ読まれるため
# 対話シェル限定。普段は grep 数回の軽量チェックで済み、pin を上げて pull した直後の
# 最初のシェル起動時に一度だけ再登録(数秒)が走る。
_semble_pin_reflect() {
  command -v uv >/dev/null 2>&1 && command -v claude >/dev/null 2>&1 || return 0
  local script="$HOME/dotfiles/scripts/install-semble.sh"
  local registry="$HOME/.claude.json"
  [[ -f "$script" ]] || return 0
  local pin
  pin=$(sed -n 's/.*semble==\([0-9.]*\).*/\1/p' "$script" | head -1)
  [[ -n "$pin" ]] || return 0
  # 未登録(ファイル無し)のときも登録対象。既に一致していれば何もしない。
  if ! grep -qF "semble[mcp]==$pin" -- "$registry" 2>/dev/null; then
    echo "semble の pin($pin) を Claude Code に反映します..." >&2
    "$script" >&2
  fi
}
_semble_pin_reflect
