#!/bin/bash

# claude CLI と共有プラグインを導入する初回セットアップ。
# 対話シェル起動を遅くしないため、_claude.zsh からは自動実行せず、
# 新しいマシンで一度だけ手動で実行する。

set -euo pipefail

# claude CLI は ~/.local/bin に入るため、このスクリプト実行中のみ PATH に追加する。
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI をインストールします..."
  curl -fsSL https://claude.ai/install.sh | bash
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI のインストールに失敗しました。" >&2
  exit 1
fi

# 導入済みプラグイン一覧は1回だけ取得して使い回す（plugin list はノード起動を伴い重い）。
installed_plugins="$(claude plugin list 2>/dev/null || true)"

ensure_plugin() {
  local plugin_ref="$1" marketplace_repo="$2"
  if ! printf '%s\n' "$installed_plugins" | grep -q "$plugin_ref"; then
    claude plugin marketplace add "$marketplace_repo"
    claude plugin install "$plugin_ref"
  fi
}

ensure_plugin "crit@crit" "tomasz-tomczyk/crit"
ensure_plugin "product-skills@claude-code-skills" "alirezarezvani/claude-skills"
ensure_plugin "skill-scanner@skillplugs" "skillplugs/plugins"

# 導入済みプラグインを最新へ更新する。
"$(dirname "$0")/update-plugins.sh"
