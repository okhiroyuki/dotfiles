#!/usr/bin/env python3
"""Regression tests for the doc-review hooks."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
from pathlib import Path


HOOKS = Path(__file__).parent
STATE = HOOKS / "doc-review-state.py"
REQUIRE = HOOKS / "require-tech-writing-skill.py"
GATE = HOOKS / "doc-review.py"
SETTINGS = HOOKS.parent.parent / "host-private" / "claude" / "settings.json"


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_hook(script: Path, args: list[str], payload: dict | str | None):
    stdin = payload if isinstance(payload, str) else (
        None if payload is None else json.dumps(payload)
    )
    return subprocess.run(
        [sys.executable, str(script), *args],
        input=stdin,
        capture_output=True,
        text=True,
        check=False,
    )


def record(action: str, payload: dict) -> None:
    result = run_hook(STATE, [action], payload)
    assert result.returncode == 0, result.stderr


state_mod = load("doc_review_state", STATE)
require_mod = load("require_tech_writing_skill", REQUIRE)
gate_mod = load("doc_review", GATE)


class StateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.base = {
            "session_id": f"s-{uuid.uuid4()}",
            "prompt_id": f"p-{uuid.uuid4()}",
        }

    def state(self) -> dict | None:
        return state_mod.read_state(self.base)

    def test_missing_ids_fail_open(self) -> None:
        self.assertIsNone(state_mod.state_path({"session_id": "only-session"}))
        self.assertIsNone(state_mod.read_state({"session_id": "only-session"}))

    def test_turns_are_isolated(self) -> None:
        record("write", {**self.base, "tool_name": "Write",
                         "tool_input": {"file_path": "/tmp/a.md"}})
        other = {**self.base, "prompt_id": f"p-{uuid.uuid4()}"}
        self.assertIsNone(state_mod.read_state(other))
        self.assertEqual(self.state()["written"], ["/tmp/a.md"])

    def test_subagent_skill_is_not_recorded(self) -> None:
        # 先に書き込みを記録して状態ファイルを作っておく
        record("write", {**self.base, "tool_name": "Write",
                         "tool_input": {"file_path": "/tmp/sub.md"}})
        record("skill", {**self.base, "tool_name": "Skill", "agent_id": "agent-1",
                         "tool_input": {"skill": "ns:japanese-tech-writing"}})
        self.assertEqual(self.state()["skills"], [])

    def test_main_skill_is_recorded(self) -> None:
        record("skill", {**self.base, "tool_name": "Skill",
                         "tool_input": {"skill": "japanese-tech-writing"}})
        self.assertEqual(self.state()["skills"], ["japanese-tech-writing"])

    def test_subagent_write_is_recorded(self) -> None:
        record("write", {**self.base, "tool_name": "Write", "agent_id": "agent-1",
                         "tool_input": {"file_path": "/tmp/sub.md"}})
        self.assertEqual(self.state()["written"], ["/tmp/sub.md"])

    def test_duplicate_entries_are_idempotent(self) -> None:
        for _ in range(2):
            record("write", {**self.base, "tool_name": "Edit",
                             "tool_input": {"file_path": "/tmp/a.md"}})
            record("skill", {**self.base, "tool_name": "Skill",
                             "tool_input": {"skill": "japanese-tech-writing"}})
        state = self.state()
        self.assertEqual(state["written"], ["/tmp/a.md"])
        self.assertEqual(state["skills"], ["japanese-tech-writing"])

    def test_recovers_from_invalid_state(self) -> None:
        path = state_mod.state_path(self.base)
        path.write_text("not json", encoding="utf-8")
        record("write", {**self.base, "tool_name": "Write",
                         "tool_input": {"file_path": "/tmp/a.md"}})
        self.assertEqual(self.state()["written"], ["/tmp/a.md"])


class CleanupTest(unittest.TestCase):
    def test_removes_only_expired_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            original = state_mod.STATE_ROOT
            state_mod.STATE_ROOT = Path(tmp)
            try:
                old = Path(tmp) / "old.json"
                old.write_text("{}", encoding="utf-8")
                os.utime(old, (time.time() - 7200, time.time() - 7200))
                recent = Path(tmp) / "recent.json"
                recent.write_text("{}", encoding="utf-8")
                state_mod.cleanup()
                self.assertFalse(old.exists())
                self.assertTrue(recent.exists())
            finally:
                state_mod.STATE_ROOT = original


class WrittenTextTest(unittest.TestCase):
    def test_write_uses_content(self) -> None:
        self.assertEqual(require_mod.written_text("Write", {"content": "あい"}),
                         "あい")

    def test_edit_uses_new_string(self) -> None:
        self.assertEqual(require_mod.written_text("Edit", {"new_string": "あい"}),
                         "あい")

    def test_multiedit_joins_edits(self) -> None:
        text = require_mod.written_text("MultiEdit", {
            "edits": [{"new_string": "あ"}, {"new_string": "い"}],
        })
        self.assertEqual(text, "あ\nい")


class RequireTechWritingGateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.base = {
            "session_id": f"s-{uuid.uuid4()}",
            "prompt_id": f"p-{uuid.uuid4()}",
        }
        self.payload = {
            **self.base,
            "tool_name": "Edit",
            "tool_input": {"file_path": "/tmp/doc.md", "new_string": "あいうえおかき"},
        }

    def gate(self, **overrides) -> int:
        return run_hook(REQUIRE, [], {**self.payload, **overrides}).returncode

    def test_passes_below_default_threshold(self) -> None:
        # 閾値未指定の既定値 400 では payload の 6 字は通る
        self.assertEqual(self.gate(), 0)

    def test_threshold_boundary_with_skill_state(self) -> None:
        record("skill", {**self.base, "tool_name": "Skill",
                         "tool_input": {"skill": "japanese-tech-writing"}})
        result = subprocess.run(
            [sys.executable, str(REQUIRE)],
            input=json.dumps(self.payload),
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "TECH_WRITING_GATE_THRESHOLD": "5"},
        )
        self.assertEqual(result.returncode, 0)

    def test_blocks_first_write_without_skill(self) -> None:
        # ターン開始直後（状態ファイルなし）でもスキル未起動なら止める
        result = subprocess.run(
            [sys.executable, str(REQUIRE)],
            input=json.dumps(self.payload),
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "TECH_WRITING_GATE_THRESHOLD": "5"},
        )
        self.assertEqual(result.returncode, 2)

    def test_fails_open_without_turn_ids(self) -> None:
        # ターン識別子が取れないときだけ判断できないとして通す
        payload = {k: v for k, v in self.payload.items() if k != "prompt_id"}
        result = subprocess.run(
            [sys.executable, str(REQUIRE)],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "TECH_WRITING_GATE_THRESHOLD": "5"},
        )
        self.assertEqual(result.returncode, 0)

    def test_namespaced_skill_name_matches(self) -> None:
        record("skill", {**self.base, "tool_name": "Skill",
                         "tool_input": {"skill": "plugin:japanese-tech-writing"}})
        result = subprocess.run(
            [sys.executable, str(REQUIRE)],
            input=json.dumps(self.payload),
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "TECH_WRITING_GATE_THRESHOLD": "5"},
        )
        self.assertEqual(result.returncode, 0)

    def test_subagent_call_is_out_of_scope(self) -> None:
        result = subprocess.run(
            [sys.executable, str(REQUIRE)],
            input=json.dumps({**self.payload, "agent_id": "agent-1"}),
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "TECH_WRITING_GATE_THRESHOLD": "5"},
        )
        self.assertEqual(result.returncode, 0)


class ChangedJapaneseTest(unittest.TestCase):
    def count(self, previous: str | None, current: str) -> int:
        with tempfile.TemporaryDirectory() as tmp:
            doc = Path(tmp) / "doc.md"
            doc.write_text(current, encoding="utf-8")
            if previous is not None:
                snap_dir = doc.parent / gate_mod.STATE_DIR
                snap_dir.mkdir()
                (snap_dir / doc.name).write_text(previous, encoding="utf-8")
            return gate_mod.changed_japanese(doc)

    def test_full_text_without_snapshot(self) -> None:
        self.assertEqual(self.count(None, "あいう" * 5), 15)

    def test_replace_counts_larger_side(self) -> None:
        self.assertEqual(self.count("あいうえお", "かきく"), 5)

    def test_addition_counts_added_line(self) -> None:
        self.assertEqual(self.count("あ\n", "あ\nいいいい"), 4)

    def test_deletion_counts_removed_line(self) -> None:
        self.assertEqual(self.count("ああああ\nいいい", "ああああ"), 3)


class DocGateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.turn = tempfile.TemporaryDirectory()
        self.doc = Path(self.turn.name) / "doc.md"
        self.doc.write_text("あいうえおかき", encoding="utf-8")
        self.base = {
            "session_id": f"s-{uuid.uuid4()}",
            "prompt_id": f"p-{uuid.uuid4()}",
        }

    def tearDown(self) -> None:
        self.turn.cleanup()

    def record_write(self) -> None:
        record("write", {**self.base, "tool_name": "Write",
                         "tool_input": {"file_path": str(self.doc)}})

    def gate(self, payload: dict | str, threshold: str | None = None) -> int:
        env = {**os.environ}
        if threshold is not None:
            env["DOC_REVIEW_THRESHOLD"] = threshold
        return subprocess.run(
            [sys.executable, str(GATE), "gate"],
            input=payload if isinstance(payload, str) else json.dumps(payload),
            capture_output=True,
            text=True,
            check=False,
            env=env,
        ).returncode

    def test_blocks_at_threshold(self) -> None:
        self.record_write()
        self.assertEqual(self.gate(self.base, threshold="6"), 2)

    def test_passes_below_threshold(self) -> None:
        # doc は日本語 7 字なので閾値 8 なら通る
        self.record_write()
        self.assertEqual(self.gate(self.base, threshold="8"), 0)

    def test_passes_on_second_stop(self) -> None:
        self.record_write()
        self.assertEqual(self.gate({**self.base, "stop_hook_active": 1}, threshold="1"), 0)

    def test_passes_on_invalid_input(self) -> None:
        self.assertEqual(self.gate("not json"), 0)

    def test_ignores_out_of_scope_paths(self) -> None:
        self.assertFalse(gate_mod.is_target(Path("/tmp/x.doc-review/doc.md")))
        self.assertFalse(gate_mod.is_target(Path("/tmp/node_modules/doc.md")))
        self.assertFalse(gate_mod.is_target(Path("/tmp/doc.txt")))


class SettingsWiringTest(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = json.loads(SETTINGS.read_text(encoding="utf-8"))

    def commands(self, event: str) -> list[tuple[str, str]]:
        pairs = []
        for entry in self.settings["hooks"].get(event, []):
            for hook in entry.get("hooks", []):
                pairs.append((entry.get("matcher", ""), hook.get("command", "")))
        return pairs

    def test_pre_tool_use_gates_writes(self) -> None:
        self.assertIn(
            ("Write|Edit|MultiEdit|NotebookEdit",
             "python3 ~/.claude/hooks/require-tech-writing-skill.py"),
            self.commands("PreToolUse"),
        )

    def test_post_tool_use_records_state(self) -> None:
        pairs = self.commands("PostToolUse")
        self.assertIn(("Write|Edit|MultiEdit|NotebookEdit",
                       "python3 ~/.claude/hooks/doc-review-state.py write"), pairs)
        self.assertIn(("Skill", "python3 ~/.claude/hooks/doc-review-state.py skill"),
                      pairs)

    def test_stop_gate_runs(self) -> None:
        self.assertIn(("", "python3 ~/.claude/hooks/doc-review.py gate"),
                      self.commands("Stop"))

    def test_mark_is_allowed(self) -> None:
        self.assertIn("Bash(python3 ~/.claude/hooks/doc-review.py mark:*)",
                      self.settings["permissions"]["allow"])


if __name__ == "__main__":
    unittest.main()
