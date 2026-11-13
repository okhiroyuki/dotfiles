#!/usr/bin/env python3
"""まとまった量の日本語Markdownを書く前に japanese-tech-writing スキルの起動を強制する。

PreToolUse (Write|Edit|MultiEdit|NotebookEdit) から呼ばれる。書き込む日本語の文字数が閾値を超え、
最後のユーザー発言以降に Skill(japanese-tech-writing) を呼んでいなければ exit 2 で止める。
ターン単位で見るのは、書き直しのたびにスキルで見直させるため。

ターン識別子があれば、状態が空でも「まだスキルを起動していない」とみなして止める。
判断できない状況（入力の解析失敗・ターン識別子がない・サブエージェント）は fail open で通す。
"""

from __future__ import annotations

import json
import os
import re
import sys
import importlib.util
from pathlib import Path

SKILL_NAME = "japanese-tech-writing"
DEFAULT_THRESHOLD = 400
JAPANESE_CHAR = re.compile(r"[぀-ヿ一-鿿]")
TARGET_SUFFIXES = (".md", ".markdown")
STATE_HOOK = Path(__file__).with_name("doc-review-state.py")
GATE_HOOK = Path(__file__).with_name("doc-review.py")


def load_state_module():
    spec = importlib.util.spec_from_file_location("doc_review_state", STATE_HOOK)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def written_text(tool_name: str, tool_input: dict) -> str:
    if tool_name == "Write":
        return tool_input.get("content") or ""
    if tool_name == "Edit":
        return tool_input.get("new_string") or ""
    if tool_name in {"MultiEdit", "NotebookEdit"}:
        return "\n".join(
            edit.get("new_string") or ""
            for edit in tool_input.get("edits") or []
            if isinstance(edit, dict)
        )
    return ""


def save_baseline(tool_input: dict) -> None:
    """Stop ゲートの比較基準として、記録のない既存文書の編集前の本文を保存する。

    ゲートのスキップ・サブエージェント・閾値未満でも保存する。サブエージェントの書き込みも
    親の Stop ゲートで数えるため、基準がないと全文が差分になる。保存の失敗は書き込みを止めない。
    """
    file_path = tool_input.get("file_path")
    if not isinstance(file_path, str) or not file_path.endswith(TARGET_SUFFIXES):
        return
    try:
        spec = importlib.util.spec_from_file_location("doc_review_gate", GATE_HOOK)
        if spec is None or spec.loader is None:
            return
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.baseline(file_path)
    except Exception:  # noqa: BLE001 - 基準の保存は補助機能なので何があっても書き込みを止めない
        pass


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    if not isinstance(payload, dict):
        return 0

    save_baseline(payload.get("tool_input") or {})

    # 一時的に黙らせたいときの逃げ道。
    if os.environ.get("TECH_WRITING_GATE_SKIP") == "1":
        return 0

    # サブエージェントは状態を共有するため、スキル起動済みと誤判定される恐れがある。対象外にする。
    if payload.get("agent_id"):
        return 0

    # ターン識別子が取れないときだけ判断できないとして fail open する。
    # state_path は prompt_id 欠落を "none" に正規化するため、生の識別子をここで見る。
    if not payload.get("session_id") or not payload.get("prompt_id"):
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
    if count <= threshold:
        return 0

    state_module = load_state_module()
    if state_module is None:
        return 0
    state = state_module.read_state(payload)
    if state is None:
        # ターン識別子はあるが状態ファイルがない＝ターン開始直後でまだ何も記録されていない。
        # 最初の書き込みでもスキル未起動なら止める（transcript 方式と同じ強度）。
        state = {"written": [], "skills": []}
    if any(
        skill.rsplit(":", 1)[-1] == SKILL_NAME
        for skill in state.get("skills", [])
    ):
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
