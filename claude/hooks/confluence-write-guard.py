#!/usr/bin/env python3
"""Confluence に書き込む `confluence` CLI の実行を、毎回ユーザーの確認に回す。

ルール文や skill の「承認を得てから」だけでは、依頼文を承認と読み替えて
書き込んでしまうことがある。PreToolUse で permissionDecision=ask を返し、
auto mode や allow ルールがあっても確認ダイアログを必ず出す。

判定は「読み取りと分かっているものだけ通す」許可リスト方式。
未知のサブコマンドや解釈できないコマンドは書き込みとみなして確認に回す。
"""

import json
import os
import re
import shlex
import sys

# Confluence を読むだけ、またはローカルの CLI 状態だけを触るサブコマンド。
# 値が None のものはサブコマンド単体で読み取り。集合のものは第 2 階層まで見る。
READ_ONLY: dict[str, set[str] | None] = {
    "get": None,
    "search": None,
    "history": None,
    "syntax": None,
    "user": None,
    "update": None,  # CLI 自体の更新。Confluence には書き込まない
    "auth": None,
    "config": None,
    "comment": {"list"},
    "label": {"list"},
    "attach": {"list"},
    "folder": {"get"},
}

HELP_FLAGS = {"-h", "--help", "-v", "--version"}

# コマンドの前に付いて、実体のコマンドを後ろに取るラッパー。
WRAPPERS = {"rtk", "command", "env", "exec", "time", "nohup", "sudo", "xargs", "npx", "pnpx", "pnpm"}
SHELLS = {"sh", "bash", "zsh"}
ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
FALLBACK_RE = re.compile(r"(?:^|[\s;&|(`/])confluence\s+(\S+)(?:\s+(\S+))?")


def tokenize(command: str) -> list[str] | None:
    # 改行もコマンドの区切り。ヒアドキュメント本文まで拾うが、確認に倒れるだけなので許容する
    command = command.replace("\n", " ; ")
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|()`")
    lexer.whitespace_split = True
    lexer.commenters = ""
    try:
        return list(lexer)
    except ValueError:
        return None


def segments(tokens: list[str]) -> list[list[str]]:
    out, cur = [], []
    for t in tokens:
        if set(t) <= set(";&|()`"):
            if cur:
                out.append(cur)
            cur = []
        else:
            cur.append(t)
    if cur:
        out.append(cur)
    return out


def is_write(args: list[str]) -> bool:
    """`confluence` の後ろの引数列が書き込みかどうか。"""
    positional = [a for a in args if not a.startswith("-")]
    if not positional:
        # 引数なし・ヘルプ・バージョン表示は読み取り
        return not (not args or any(a in HELP_FLAGS for a in args))
    if any(a in HELP_FLAGS for a in args):
        return False
    sub = positional[0]
    if sub not in READ_ONLY:
        return True
    allowed = READ_ONLY[sub]
    if allowed is None:
        return False
    return len(positional) < 2 or positional[1] not in allowed


def find_writes(command: str, depth: int = 0) -> list[str]:
    """書き込みに当たる `confluence ...` 呼び出しを返す。"""
    tokens = tokenize(command)
    if tokens is None:
        # クォートが閉じていないなど。正規表現で拾い、読み取りと分かるもの以外は確認に回す
        return [
            m.group(0).strip()
            for m in FALLBACK_RE.finditer(command)
            if is_write([g for g in m.groups() if g])
        ]

    found = []
    for seg in segments(tokens):
        i = 0
        while i < len(seg) and (ASSIGN_RE.match(seg[i]) or seg[i] in WRAPPERS):
            i += 1
            # rtk proxy / pnpm exec のような 2 語目も読み飛ばす
            while i < len(seg) and seg[i] in {"proxy", "exec", "--"}:
                i += 1
            while i < len(seg) and seg[i].startswith("-"):
                i += 1
        if i >= len(seg):
            continue
        name = os.path.basename(seg[i])
        rest = seg[i + 1:]
        if name == "confluence":
            if is_write(rest):
                found.append(" ".join(seg[i:]))
        elif name in SHELLS and depth < 3:
            for j, a in enumerate(rest):
                if a == "-c" and j + 1 < len(rest):
                    found.extend(find_writes(rest[j + 1], depth + 1))
                    break
    return found


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    if payload.get("tool_name") != "Bash":
        return 0
    command = payload.get("tool_input", {}).get("command", "")
    if "confluence" not in command:
        return 0

    writes = find_writes(command)
    if not writes:
        return 0

    reason = (
        "Confluence への書き込み（作成・更新・コメント・ラベル・添付・移動・同期など）は、"
        "ユーザーが原稿を確認し、この操作を明示的に指示した場合だけ実行する。"
        "依頼文から「上げてよい」と推測しない。\n対象: " + " / ".join(writes)
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": reason,
        }
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
