#!/usr/bin/env python3
"""まとまった量の日本語Markdownを書く前に japanese-tech-writing スキルの起動を強制する。

PreToolUse (Write|Edit) から呼ばれる。書き込む日本語の文字数が閾値以上で、
最後のユーザー発言以降に Skill(japanese-tech-writing) を呼んでいなければ exit 2 で止める。
ターン単位で見るのは、書き直しのたびにスキルで見直させるため。

判断できない状況（入力の解析失敗・transcript がない・サブエージェント）は fail open で通す。
"""

import json
import os
import re
import sys

SKILL_NAME = "japanese-tech-writing"
DEFAULT_THRESHOLD = 400
JAPANESE_CHAR = re.compile(r"[぀-ヿ一-鿿]")
TARGET_SUFFIXES = (".md", ".markdown")


def written_text(tool_name: str, tool_input: dict) -> str:
    if tool_name == "Write":
        return tool_input.get("content") or ""
    if tool_name == "Edit":
        return tool_input.get("new_string") or ""
    return ""


def is_user_prompt(entry: dict) -> bool:
    """ツール結果やスキル本文の注入ではない、ユーザー自身の発言か。"""
    if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isSidechain"):
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    if isinstance(content, list):
        return not any(
            isinstance(block, dict) and block.get("type") == "tool_result"
            for block in content
        )
    return False


def calls_skill(entry: dict) -> bool:
    if entry.get("type") != "assistant":
        return False
    content = (entry.get("message") or {}).get("content")
    if not isinstance(content, list):
        return False
    for block in content:
        if (
            isinstance(block, dict)
            and block.get("type") == "tool_use"
            and block.get("name") == "Skill"
            and (block.get("input") or {}).get("skill") == SKILL_NAME
        ):
            return True
    return False


def skill_called_this_turn(transcript_path: str) -> bool:
    called = False
    with open(transcript_path, encoding="utf-8") as f:
        for line in f:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if is_user_prompt(entry):
                called = False
            elif calls_skill(entry):
                called = True
    return called


def main() -> int:
    # 一時的に黙らせたいときの逃げ道。
    if os.environ.get("TECH_WRITING_GATE_SKIP") == "1":
        return 0

    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    # サブエージェントの呼び出しは本体の transcript で判定できないため対象外にする。
    if payload.get("agent_id"):
        return 0

    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or ""
    if not file_path.endswith(TARGET_SUFFIXES):
        return 0

    try:
        threshold = int(os.environ.get("TECH_WRITING_GATE_THRESHOLD", DEFAULT_THRESHOLD))
    except ValueError:
        threshold = DEFAULT_THRESHOLD

    text = written_text(payload.get("tool_name") or "", tool_input)
    count = len(JAPANESE_CHAR.findall(text))
    if count < threshold:
        return 0

    transcript_path = payload.get("transcript_path") or ""
    try:
        if skill_called_this_turn(transcript_path):
            return 0
    except OSError:
        return 0

    print(
        f"日本語の文章を {count} 字書き込もうとしていますが、このターンで "
        f"{SKILL_NAME} スキルを起動していません。\n"
        f"先に Skill ツールで {SKILL_NAME} を起動し、その規則に沿って文章を見直してから書き込んでください。\n"
        f"コードや設定値が大半で文章の推敲が不要な場合は、書き込まずにユーザーへ理由を伝えてください。",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
