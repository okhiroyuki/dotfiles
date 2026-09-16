#!/bin/sh
# Markdownを書き換えたあとにtextlintをかけ、AIっぽい日本語と技術文書として雑な表記をエージェント自身に直させる。
#
# PostToolUse (Write|Edit) から呼ばれる。編集はすでに終わっているのでブロックはできないが、
# exit 2 で stderr を Claude に返すと、指示なしで書き直しに入る。
#
# 検出設定の単一の真実の源は tools/textlint/.textlintrc.json。
# 判断できない状況（未インストール・nodeが見つからない・対象外の拡張子）は fail open で通す。

set -u

TEXTLINT_DIR="$HOME/dotfiles/tools/textlint"

# 一時的に黙らせたいときの逃げ道。英語中心のリポジトリなどで使う。
[ "${TEXTLINT_AI_WORDS_SKIP:-0}" = "1" ] && exit 0

file_path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$file_path" ] || exit 0
[ -f "$file_path" ] || exit 0

case "$file_path" in
  *.md | *.markdown) ;;
  *) exit 0 ;;
esac
case "$file_path" in
  */node_modules/* | */.git/*) exit 0 ;;
esac

[ -x "$TEXTLINT_DIR/node_modules/.bin/textlint" ] || exit 0

# hookはログインシェルを経由しないため、mise管理下のnodeがPATHに乗っていないことがある。
if ! command -v node >/dev/null 2>&1; then
  for candidate in \
    "$HOME/.local/share/mise/shims" \
    /opt/homebrew/bin \
    /usr/local/bin; do
    if [ -x "$candidate/node" ]; then
      PATH="$candidate:$PATH"
      export PATH
      break
    fi
  done
fi
command -v node >/dev/null 2>&1 || exit 0

out=$(
  "$TEXTLINT_DIR/node_modules/.bin/textlint" \
    --config "$TEXTLINT_DIR/.textlintrc.json" \
    --format stylish \
    "$file_path" 2>&1
) && exit 0

# textlintの実行そのものが失敗した場合（設定不備など）は指摘と区別できないが、
# 黙って通すと検出漏れに気づけないため、そのまま出力を返す。
{
  echo "textlint（日本語Markdownの検出）が指摘を返しました。該当箇所を書き直してください。"
  echo "文脈上その語が適切なら、書き直さずユーザーに理由を伝えてください。"
  echo
  echo "$out"
} >&2
exit 2
