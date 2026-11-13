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
    # prompt_id は通常のツール呼び出しでは必ず含まれるが、仕様上「初回ユーザー入力前」
    # などは欠け得る。欠落時はセッション単位のキーに正規化して状態を保持し、
    # ターン分離の代替は cleanup の mtime 期限(1時間)に任せる。
    prompt_id = payload.get("prompt_id") or "none"
    if not session_id:
        return None
    key = hashlib.sha256(f"{session_id}:{prompt_id}".encode()).hexdigest()
    return STATE_ROOT / f"{key}.json"


def _merge_lists(fresh: dict, before: dict, mutated: dict) -> dict:
    """状態への変更は追記だけなので、無排他時に書き戻すときは和集合で合流する。

    ロックを取れなかった場合も、読み取り時の差分だけを現在の状態に積み上げる。
    これで後勝ちの上書きで他プロセスの追記が消えることを防ぐ。
    """
    merged = dict(fresh)
    for key in ("written", "skills", "asked"):
        old = before.get(key) or []
        new = mutated.get(key) or []
        if key not in merged and key not in mutated:
            continue
        current = list(merged.get(key) or [])
        for item in new:
            if item not in old and item not in current:
                current.append(item)
        merged[key] = current
    return merged


@contextmanager
def locked_state(payload: dict) -> Iterator[dict | None]:
    path = state_path(payload)
    if path is None:
        yield None
        return
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with path.with_suffix(".lock").open("a+") as lock_file:
        locked = False
        try:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            locked = True
        except OSError:
            # 一度だけ待って再試行し、それでも取れなければロックなしで続行する。
            # 排他を断念するより記録が失われてゲートが誤ブロックする方が害が大きい。
            # ロックなし時の更新ロスは書き戻し時の和集合マージで吸収する。
            time.sleep(0.05)
            try:
                import fcntl

                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
                locked = True
            except OSError:
                locked = False
        try:
            try:
                state = json.loads(path.read_text(encoding="utf-8"))
            except (FileNotFoundError, json.JSONDecodeError, OSError):
                state = {"written": [], "skills": []}
            if not isinstance(state, dict):
                state = {"written": [], "skills": []}
            before = json.loads(json.dumps(state))
            yield state
            fresh = _read_json(path)
            merged = _merge_lists(fresh or {}, before, state)
            temporary = path.with_suffix(f".{os.getpid()}.tmp")
            temporary.write_text(json.dumps(merged), encoding="utf-8")
            os.replace(temporary, path)
        finally:
            if locked:
                try:
                    import fcntl

                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
                except (ImportError, OSError):
                    pass


def _read_json(path: Path) -> dict | None:
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None
    return state if isinstance(state, dict) else None


def cleanup() -> None:
    """放置された古い状態・一時ファイルを掃除して蓄積を防ぐ。

    ロックファイルは削除しない。削除の瞬間に旧 inode を待つプロセスがいると、
    新旧のロックで排他が分裂する。ロックファイルは 0 バイトなので蓄積の害は小さく、
    寿命は OS 側の一時ディレクトリ掃除に任せる。
    """
    now = time.time()
    try:
        entries = list(STATE_ROOT.iterdir())
    except OSError:
        return
    for entry in entries:
        try:
            if entry.name.endswith(".lock"):
                continue
            if now - entry.stat().st_mtime <= CLEANUP_SECONDS:
                continue
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


def is_review_question(tool_input: dict) -> bool:
    """文書レビューの確認（選択肢に crit を含む質問）かどうかを判定する。

    review.md の確認は「5 人のレビュアー / crit / どちらもしない」を必ず並べ、
    採否確認後の質問にも crit を加える。crit を含む選択肢を目印にする。
    """
    questions = tool_input.get("questions")
    if not isinstance(questions, list):
        return False
    for question in questions:
        if not isinstance(question, dict):
            continue
        for option in question.get("options") or []:
            if isinstance(option, dict) and "crit" in str(option.get("label", "")).lower():
                return True
    return False


def add_review_question(payload: dict) -> bool:
    """このターンでレビュー確認の質問を出したことを記録する。

    Stop hook が、すでに聞いた確認をもう一度求めないようにするため。
    サブエージェントは質問ツールでユーザーに聞けないので、メインの質問だけを記録する。
    """
    if payload.get("agent_id"):
        return False
    tool_input = payload.get("tool_input") or {}
    if not isinstance(tool_input, dict) or not is_review_question(tool_input):
        return False
    with locked_state(payload) as state:
        if state is None:
            return False
        asked = state.setdefault("asked", [])
        if "review" not in asked:
            asked.append("review")
    return True


def read_state(payload: dict) -> dict | None:
    path = state_path(payload)
    if path is None:
        return None
    return _read_json(path)


def log_payload_keys(payload: dict) -> None:
    """フック入力のキー一覧を初回だけ記録する。将来のフィールド増減に気づくため。"""
    try:
        STATE_ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
        marker = STATE_ROOT / ".keys-logged"
        if marker.exists():
            return
        line = json.dumps(sorted(payload.keys()), ensure_ascii=False)
        (STATE_ROOT / "payload-keys.log").write_text(line + "\n", encoding="utf-8")
        marker.write_text("", encoding="utf-8")
    except OSError:
        pass


def main() -> int:
    cleanup()
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    if not isinstance(payload, dict):
        return 0
    log_payload_keys(payload)
    if sys.argv[1:] == ["write"]:
        add_written_file(payload)
    elif sys.argv[1:] == ["skill"]:
        add_skill(payload)
    elif sys.argv[1:] == ["ask"]:
        add_review_question(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
