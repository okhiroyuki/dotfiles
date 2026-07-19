#!/usr/bin/env bash
# PreToolUse(Bash) ガード: main/master への git push を確認プロンプト(ask)に格上げする。
# トピックブランチへの push は素通りさせ、settings.json の allow に委ねる。
# ask なので過検知（保護ブランチ上での push を広めに拾う）は許容する。実害はプロンプト1回。
set -uo pipefail

input=$(cat)

# tool_input.command を取り出す（jq → python3 の順にフォールバック）
if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
else
  cmd=$(printf '%s' "$input" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)
fi
[ -z "${cmd:-}" ] && exit 0

# git push を含まないコマンドは対象外
printf '%s' "$cmd" | grep -qE '\bgit\b[^&|;]*\bpush\b' || exit 0

protected='main|master'
hit=0

# 1) push 対象に main/master が明示されている（push origin main / HEAD:main / -f origin main 等）
if printf '%s' "$cmd" | grep -qE "\bpush\b[^&|;]*\b(${protected})\b"; then
  hit=1
fi

# 2) 保護ブランチ（main/master）上での push
if [ "$hit" -eq 0 ]; then
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  printf '%s' "${branch:-}" | grep -qE "^(${protected})$" && hit=1
fi

if [ "$hit" -eq 1 ]; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"main/master への push を検知しました。意図した push か確認してください（トピックブランチへの push は自動許可されます）。"}}
JSON
  exit 0
fi

exit 0
