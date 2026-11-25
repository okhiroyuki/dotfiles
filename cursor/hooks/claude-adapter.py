#!/usr/bin/env python3
"""Cursor のフックから、既存の Claude 用フックスクリプトを呼ぶ薄い橋渡し。

既存スクリプトは書き直さず、Cursor の入力を Claude 形式に変換して実行し、
結果を Cursor の出力形式に戻す。

使い方:
  python3 claude-adapter.py <script名> shell          # beforeShellExecution 用 (Bash 扱い)
  python3 claude-adapter.py <script名> post-write     # postToolUse(Write) 用 (PostToolUse 扱い)

判断できない入力・実行失敗は fail open (allow / 空出力) で通す。
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HOOKS_DIR = Path.home() / ".claude" / "hooks"


def run_claude_hook(script: str, claude_payload: dict) -> subprocess.CompletedProcess | None:
    try:
        return subprocess.run(
            ["python3" if script.endswith(".py") else "sh", str(HOOKS_DIR / script)],
            input=json.dumps(claude_payload),
            capture_output=True,
            text=True,
            timeout=8,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None


def shell_mode(script: str, payload: dict) -> int:
    command = payload.get("command") or (payload.get("tool_input") or {}).get("command", "")
    result = run_claude_hook(script, {
        "hook_event_name": "PreToolUse",
        "tool_name": "Bash",
        "tool_input": {"command": command},
    })
    if result is None:
        print(json.dumps({"permission": "allow"}))
        return 0

    # exit 2 = ブロック。stderr の理由を返す
    if result.returncode == 2:
        message = result.stderr.strip() or "hook によりブロックされました"
        print(json.dumps({"permission": "deny", "user_message": message, "agent_message": message},
                         ensure_ascii=False))
        return 0

    # JSON で permissionDecision を返すスクリプト（confluence-write-guard など）
    try:
        decision = json.loads(result.stdout or "{}").get("hookSpecificOutput", {})
    except ValueError:
        decision = {}
    kind = decision.get("permissionDecision")
    if kind in ("ask", "deny"):
        reason = decision.get("permissionDecisionReason", "")
        print(json.dumps({"permission": kind, "user_message": reason, "agent_message": reason},
                         ensure_ascii=False))
        return 0

    print(json.dumps({"permission": "allow"}))
    return 0


def post_write_mode(script: str, payload: dict) -> int:
    tool_input = payload.get("tool_input") or {}
    file_path = payload.get("file_path") or tool_input.get("file_path") or ""
    result = run_claude_hook(script, {
        "hook_event_name": "PostToolUse",
        "tool_name": "Write",
        "tool_input": {"file_path": file_path},
    })
    # 編集はもう終わっているので、指摘はエージェントへの追加文脈として返す
    if result is not None and result.returncode == 2:
        note = result.stderr.strip()
        if note:
            print(json.dumps({"additional_context": note}, ensure_ascii=False))
    return 0


def main() -> int:
    if len(sys.argv) != 3:
        return 0
    script, mode = sys.argv[1], sys.argv[2]

    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        print(json.dumps({"permission": "allow"}))
        return 0
    if not isinstance(payload, dict):
        print(json.dumps({"permission": "allow"}))
        return 0

    if mode == "shell":
        return shell_mode(script, payload)
    if mode == "post-write":
        return post_write_mode(script, payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
