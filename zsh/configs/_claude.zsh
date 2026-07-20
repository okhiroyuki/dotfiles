# claude CLI は ~/.local/bin に入るため PATH に追加する。
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac

# claude 未インストール・プラグイン未導入時のブートストラップは
# scripts/setup-claude.sh に分離した。リモートスクリプトの自動実行や
# 起動ごとの plugin list 呼び出しはシェル起動を遅くするため、ここでは行わない。
if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI が見つかりません。~/dotfiles/scripts/setup-claude.sh を実行してください。" >&2
else
  # プラグインの更新は1日1回だけ（起動ごとのネットワーク処理を避ける）。
  _claude_plugin_update_stamp="$HOME/.cache/claude/plugin-update-stamp"
  if [ ! -f "$_claude_plugin_update_stamp" ] || [ -n "$(find "$_claude_plugin_update_stamp" -mtime +1)" ]; then
    ~/dotfiles/scripts/update-plugins.sh
    mkdir -p "$(dirname "$_claude_plugin_update_stamp")"
    touch "$_claude_plugin_update_stamp"
  fi
  unset _claude_plugin_update_stamp
fi
