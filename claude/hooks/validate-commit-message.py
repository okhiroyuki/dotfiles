#!/usr/bin/env python3
"""git commit のメッセージが規約を満たすか PreToolUse で検証する。

規約の実体はこのスクリプトが単一の真実の源。CLAUDE.md 側に書式を書かないため、
エラーメッセージは「何が悪いか」だけでなく「どう書くか」まで示す。

判定できない形（-F / heredoc / エディタ起動）は fail open で通す。
ブロックしたい対象は Claude が -m で組み立てたメッセージのみ。
"""

import json
import re
import shlex
import sys

# gitmassage（~/.gitmassage）と対応させる。追加時は両方を直す。
PREFIXES = [
    "feat", "fix", "docs", "style", "refactor",
    "perf", "test", "ci", "chore", "revert", "WIP",
]
MAX_DESC = 50
VAGUE = {"fix", "update", "更新", "修正", "wip", "変更", "対応"}
AI_SIGNATURES = ["Co-Authored-By: Claude", "Generated with Claude Code", "🤖"]

PREFIX_RE = re.compile(r"^([A-Za-z]+)(\([^)]*\))?:\s*(.*)$")


def messages_from(command: str) -> list[str]:
    """コマンド文字列から -m / --message の値を取り出す。取れなければ空。"""
    try:
        tokens = shlex.split(command)
    except ValueError:
        return []
    out, i = [], 0
    while i < len(tokens):
        t = tokens[i]
        if t in ("-m", "--message") and i + 1 < len(tokens):
            out.append(tokens[i + 1])
            i += 2
            continue
        if t.startswith("--message="):
            out.append(t.split("=", 1)[1])
        elif t.startswith("-m") and len(t) > 2:
            out.append(t[2:])
        i += 1
    return out


def signature_violations(text: str) -> list[str]:
    return [f"AI署名 `{sig}` を含めない" for sig in AI_SIGNATURES if sig in text]


def violations(message: str) -> list[str]:
    subject = message.splitlines()[0].strip() if message.strip() else ""
    errs = signature_violations(message)

    if not subject:
        errs.append("説明が空")
        return errs

    m = PREFIX_RE.match(subject)
    if m:
        prefix, desc = m.group(1), m.group(3)
        if prefix not in PREFIXES:
            errs.append(f"未知のプレフィックス `{prefix}`。使えるのは: {', '.join(PREFIXES)}")
    else:
        desc = subject

    if len(desc) > MAX_DESC:
        errs.append(f"説明部分が{len(desc)}文字（{MAX_DESC}文字以内）")
    if desc.strip().lower() in VAGUE:
        errs.append(f"`{desc}` だけでは何を変えたか分からない")
    if not re.search(r"[ぁ-んァ-ヶ一-龠]", desc):
        errs.append("説明部分は日本語で書く")

    return errs


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    if payload.get("tool_name") != "Bash":
        return 0
    command = payload.get("tool_input", {}).get("command", "")
    if not re.search(r"\bgit\s+commit\b", command):
        return 0

    msgs = messages_from(command)
    if not msgs:
        return 0
    # 1つ目の -m だけが subject。2つ目以降は本文なので署名だけを見る。
    errs = violations(msgs[0])
    for body in msgs[1:]:
        errs.extend(signature_violations(body))
    if not errs:
        return 0

    print(
        "コミットメッセージが規約に反しています:\n"
        + "\n".join(f"  - {e}" for e in errs)
        + "\n\n書式: `<プレフィックス>: <日本語の説明>`（説明は1行・50文字以内）\n"
          "例:   `docs: pre-commitルールにyamllint迂回手順を追加`",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
