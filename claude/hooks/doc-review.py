#!/usr/bin/env python3
"""日本語Markdownの文書レビューを、変更量に応じてユーザーに提案する。

2 つの使い方がある。

    doc-review.py gate          Stop hook。stdin に hook 入力を受け取る
    doc-review.py mark FILE...  文書の現状を「確認済み」として記録する

記録は文書と同じディレクトリの `.doc-review/<ファイル名>` に、確認した時点の本文のコピーとして置く。
`.doc-review/.gitignore` に `*` を書き、記録自体は git の対象外にする。

gate は、このターンで書き込んだ `.md` ごとに記録との差分を数える。記録がなければ全文を差分とみなす。
変更した日本語が閾値を超える文書があれば、ターンの終了を止め、レビューするかをユーザーに確認させる。
実行するか、指摘を採用するかは常にユーザーが決める。

判断できない状況（入力の解析失敗・ターン識別子がない）は fail open で通す。
"""

from __future__ import annotations

import difflib
import importlib.util
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
STATE_HOOK = Path(__file__).with_name("doc-review-state.py")


def load_state_module():
    spec = importlib.util.spec_from_file_location("doc_review_state", STATE_HOOK)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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
        state_module = load_state_module()
        state = state_module.read_state(payload) if state_module else None
        docs = [Path(p) for p in (state or {}).get("written", [])]
    except (OSError, TypeError):
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
        if count > limit:
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
        # 保存先がシンボリックリンクだと copyfile がリンク先を上書きする。
        # 信頼できないチェックアウトからの攻撃を防ぐため、リンクなら使わない。
        if state.is_symlink():
            print(f"保存先がシンボリックリンクです: {state}", file=sys.stderr)
            status = 1
            continue
        state.mkdir(exist_ok=True)
        ignore = state / ".gitignore"
        if not ignore.exists():
            ignore.write_text("*\n", encoding="utf-8")
        snapshot = state / doc.name
        # 一時ファイルはリンクをたどらない O_NOFOLLOW|O_EXCL で作り、
        # os.replace なら保存先がリンクでもリンク自体を差し替えるので安全。
        temporary = state / f".{doc.name}.{os.getpid()}.tmp"
        try:
            nofollow = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
            fd = os.open(temporary, nofollow, 0o600)
            with os.fdopen(fd, "wb") as dst, open(doc, "rb") as src:
                shutil.copyfileobj(src, dst)
            os.replace(temporary, snapshot)
        except OSError as e:
            print(f"記録に失敗しました: {doc}（{e}）", file=sys.stderr)
            status = 1
            continue
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
