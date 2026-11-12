#!/usr/bin/env python3
"""Pre/PostToolUse フック間で、現在のターンの状態を共有する。

Skill 記録はメインエージェント（agent_id なし）に限定する。サブエージェントが
スキルを起動しても、メイン側の「起動済み」判定の証拠にはならないため。

書き込みは agent_id に関係なく記録する。サブエージェントが書いた文書もメインの
ターン終了時に Stop hook のレビュー対象にするため、除外すると
「サブエージェントに書かせればレビューを回避できる」経路が生まれる。
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

STATE_ROOT = Path(tempfile.gettempdir()) / "claude-doc-review"
# この値を超えて古い状態・ロックファイルはレコード対象外にする。ターンは数分で終わるので十分長い。
CLEANUP_SECONDS = 3600


def state_path(payload: dict) -> Path | None:
    session_id = payload.get("session_id")
    prompt_id = payload.get("prompt_id")
    if not session_id or not prompt_id:
        return None
    key = hashlib.sha256(f"{session_id}:{prompt_id}".encode()).hexdigest()
    return STATE_ROOT / f"{key}.json"


@contextmanager
def locked_state(payload: dict) -> Iterator[dict | None]:
    path = state_path(payload)
    if path is None:
        yield None
        return
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with path.with_suffix(".lock").open("a+") as lock_file:
        try:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        except (ImportError, OSError):
            # 排他できない環境での read-modify-write は更新ロスの恐れがあるため、
            # 更新を中止して fail open（ゲート側は状態なしとして扱う）。
            yield None
            return
        try:
            try:
                state = json.loads(path.read_text(encoding="utf-8"))
            except (FileNotFoundError, json.JSONDecodeError, OSError):
                state = {"written": [], "skills": []}
            if not isinstance(state, dict):
                state = {"written": [], "skills": []}
            yield state
            temporary = path.with_suffix(f".{os.getpid()}.tmp")
            temporary.write_text(json.dumps(state), encoding="utf-8")
            os.replace(temporary, path)
        finally:
            try:
                import fcntl

                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            except (ImportError, OSError):
                pass


def cleanup() -> None:
    """放置された古い状態・ロック・一時ファイルを掃除して蓄積を防ぐ。"""
    now = time.time()
    try:
        entries = list(STATE_ROOT.iterdir())
    except OSError:
        return
    for entry in entries:
        try:
            if now - entry.stat().st_mtime > CLEANUP_SECONDS:
                entry.unlink()
        except OSError:
            continue


def add_written_file(payload: dict) -> bool:
    file_path = (payload.get("tool_input") or {}).get("file_path")
    if not file_path:
        return False
    with locked_state(payload) as state:
        if state is None:
            return False
        written = state.setdefault("written", [])
        if file_path not in written:
            written.append(file_path)
    return True


def add_skill(payload: dict) -> bool:
    skill = (payload.get("tool_input") or {}).get("skill")
    if not skill:
        return False
    # サブエージェント内の Skill 呼び出しはメインが起動した証拠にならないため
    # 記録しない。ただし状態ファイル自体は作る（同じターンキーを共有するため）。
    excluded = bool(payload.get("agent_id"))
    with locked_state(payload) as state:
        if state is None:
            return False
        skills = state.setdefault("skills", [])
        if not excluded and skill not in skills:
            skills.append(skill)
    return True


def read_state(payload: dict) -> dict | None:
    path = state_path(payload)
    if path is None:
        return None
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None
    return state if isinstance(state, dict) else None


def main() -> int:
    cleanup()
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    if not isinstance(payload, dict):
        return 0
    if sys.argv[1:] == ["write"]:
        add_written_file(payload)
    elif sys.argv[1:] == ["skill"]:
        add_skill(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
