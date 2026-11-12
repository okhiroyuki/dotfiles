#!/usr/bin/env python3
"""日本語Markdownの文書レビューを、変更量に応じてユーザーに提案する。

2 つの使い方がある。

    doc-review.py gate          Stop hook。stdin に hook 入力を受け取る
    doc-review.py mark FILE...  文書の現状を「確認済み」として記録する

記録は文書と同じディレクトリの `.doc-review/<ファイル名>` に、確認した時点の本文のコピーとして置く。
`.doc-review/.gitignore` に `*` を書き、記録自体は git の対象外にする。

gate は、このターンで書き込んだ `.md` ごとに記録との差分を数える。記録がなければ全文を差分とみなす。
変更した日本語が閾値以上の文書があれば、ターンの終了を止め、レビューするかをユーザーに確認させる。
実行するか、指摘を採用するかは常にユーザーが決める。

判断できない状況（入力の解析失敗・transcript がない）は fail open で通す。
"""

import difflib
import json
import os
import re
import shutil
import sys
from pathlib import Path

DEFAULT_THRESHOLD = 400
JAPANESE_CHAR = re.compile(r"[぀-ヿ一-鿿]")
TARGET_SUFFIXES = (".md", ".markdown")
STATE_DIR = ".doc-review"
WRITE_TOOLS = {"Write", "Edit", "MultiEdit"}


def japanese_count(text: str) -> int:
    return len(JAPANESE_CHAR.findall(text))


def snapshot_path(doc: Path) -> Path:
    return doc.parent / STATE_DIR / doc.name


def changed_japanese(doc: Path) -> int:
    """記録した本文からの変更量を、変更行に含まれる日本語の文字数で返す。"""
    current = doc.read_text(encoding="utf-8").splitlines()
    snap = snapshot_path(doc)
    if not snap.exists():
        return japanese_count("\n".join(current))
    previous = snap.read_text(encoding="utf-8").splitlines()
    total = 0
    matcher = difflib.SequenceMatcher(a=previous, b=current, autojunk=False)
    for tag, a1, a2, b1, b2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        removed = japanese_count("\n".join(previous[a1:a2]))
        added = japanese_count("\n".join(current[b1:b2]))
        total += max(removed, added)
    return total


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


def files_written_this_turn(transcript_path: str) -> list[Path]:
    written: dict[str, None] = {}
    with open(transcript_path, encoding="utf-8") as f:
        for line in f:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if is_user_prompt(entry):
                written.clear()
                continue
            if entry.get("type") != "assistant" or entry.get("isSidechain"):
                continue
            content = (entry.get("message") or {}).get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                if (
                    isinstance(block, dict)
                    and block.get("type") == "tool_use"
                    and block.get("name") in WRITE_TOOLS
                ):
                    path = (block.get("input") or {}).get("file_path")
                    if path:
                        written[path] = None
    return [Path(p) for p in written]


def is_target(doc: Path) -> bool:
    return (
        doc.suffix in TARGET_SUFFIXES
        and STATE_DIR not in doc.parts
        and "node_modules" not in doc.parts
        and ".git" not in doc.parts
        and doc.is_file()
    )


def threshold() -> int:
    try:
        return int(os.environ.get("DOC_REVIEW_THRESHOLD", DEFAULT_THRESHOLD))
    except ValueError:
        return DEFAULT_THRESHOLD


def gate() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    # 一度止めたあとの再停止では通す。記録の更新を忘れても無限ループにしない。
    if payload.get("stop_hook_active"):
        return 0

    try:
        docs = files_written_this_turn(payload.get("transcript_path") or "")
    except OSError:
        return 0

    limit = threshold()
    pending = []
    for doc in docs:
        if not is_target(doc):
            continue
        try:
            count = changed_japanese(doc)
        except (OSError, UnicodeDecodeError):
            continue
        if count >= limit:
            first = not snapshot_path(doc).exists()
            pending.append((doc, count, first))

    if not pending:
        return 0

    lines = [
        f"- {doc}（{'初回・全文' if first else '前回確認から'} {count} 字）"
        for doc, count, first in pending
    ]
    mark = f"python3 ~/.claude/hooks/doc-review.py mark <ファイル>"
    print(
        "次の文書は日本語の変更量が閾値を超えています。ターンを終える前に以下を行ってください。\n"
        + "\n".join(lines)
        + "\n\n"
        "1. AskUserQuestion で、文書ごとにレビューを回すかユーザーに確認する。自分で判断して省略しない\n"
        "2. 回す場合は ~/dotfiles/claude/review/doc/spec.md に従い、5 人のレビュアーと統合者でレビューする\n"
        "3. 統合結果の指摘は、重要度にかかわらず自動で修正しない。AskUserQuestion で 1 件ずつ、"
        "指摘内容と修正案を示して採否をユーザーに確認し、採用されたものだけを直す\n"
        f"4. レビューを回した場合も回さなかった場合も、最後に `{mark}` を実行して確認済みとして記録する",
        file=sys.stderr,
    )
    return 2


def mark(paths: list[str]) -> int:
    status = 0
    for raw in paths:
        doc = Path(raw).resolve()
        if not doc.is_file():
            print(f"見つかりません: {raw}", file=sys.stderr)
            status = 1
            continue
        state = doc.parent / STATE_DIR
        state.mkdir(exist_ok=True)
        ignore = state / ".gitignore"
        if not ignore.exists():
            ignore.write_text("*\n", encoding="utf-8")
        shutil.copyfile(doc, state / doc.name)
        print(f"記録しました: {doc}")
    return status


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "gate":
        return gate()
    if len(sys.argv) >= 3 and sys.argv[1] == "mark":
        return mark(sys.argv[2:])
    print("使い方: doc-review.py gate | doc-review.py mark FILE...", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
