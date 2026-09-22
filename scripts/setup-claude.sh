#!/bin/bash

# claude CLI と、settings.json で有効化されたプラグインを導入する初回セットアップ。
# 対話シェル起動を遅くしないため、_claude.zsh からは自動実行せず、
# 新しいマシンで一度だけ手動で実行する。
#
# プラグイン一覧はハードコードせず ~/.claude/settings.json から導出する。
# 新しいプラグインを増やすときは settings.json の enabledPlugins /
# extraKnownMarketplaces に追記するだけでよく、このスクリプトの変更は不要。

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

settings_file="$HOME/.claude/settings.json"

if command -v jq >/dev/null 2>&1 && [ -f "$settings_file" ]; then
  # 導入済みプラグイン一覧は1回だけ取得して使い回す（plugin list はノード起動を伴い重い）。
  installed_plugins="$(claude plugin list 2>/dev/null || true)"

  # enabledPlugins（値が true）のプラグインを順に導入する。
  # plugin_ref は "<plugin>@<marketplace>" 形式。marketplace の GitHub リポジトリは
  # extraKnownMarketplaces から引く（未登録なら marketplace add を省略して install だけ試す）。
  while IFS= read -r plugin_ref; do
    [ -n "$plugin_ref" ] || continue
    if printf '%s\n' "$installed_plugins" | grep -q "$plugin_ref"; then
      continue
    fi
    marketplace_name="${plugin_ref##*@}"
    marketplace_repo="$(jq -r --arg mp "$marketplace_name" \
      '.extraKnownMarketplaces[$mp].source.repo // empty' "$settings_file")"
    if [ -n "$marketplace_repo" ]; then
      claude plugin marketplace add "$marketplace_repo"
    fi
    claude plugin install "$plugin_ref"
  done < <(jq -r '.enabledPlugins // {} | to_entries[] | select(.value == true) | .key' "$settings_file")
else
  echo "jq または $settings_file が見つからないため、プラグインの自動導入をスキップしました。" >&2
fi

# 導入済みプラグインを最新へ更新する。
"$(dirname "$0")/update-plugins.sh"
