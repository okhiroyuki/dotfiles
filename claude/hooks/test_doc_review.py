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
from unittest import mock


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

    def test_missing_session_id_fails_open(self) -> None:
        # session_id 欠落のみ判断不能として扱う。prompt_id 欠落は "none" に正規化する。
        self.assertIsNone(state_mod.state_path({}))
        self.assertIsNone(state_mod.state_path({"prompt_id": "p-only"}))
        self.assertIsNone(state_mod.read_state({}))

    def test_missing_prompt_id_falls_back_to_session_key(self) -> None:
        # prompt_id 欠落は "none" に正規化し、セッション単位のキーで状態を保持する。
        session = f"s-{uuid.uuid4()}"
        path = state_mod.state_path({"session_id": session})
        import hashlib

        expected = hashlib.sha256(f"{session}:none".encode()).hexdigest()
        self.assertEqual(path, state_mod.STATE_ROOT / f"{expected}.json")
        self.assertIsNone(state_mod.state_path({"prompt_id": "p-only"}))

    def test_records_despite_lock_failure(self) -> None:
        # ロック取得に失敗しても記録は失われない（誤ブロック防止のためのフォールバック）。
        with mock.patch("fcntl.flock", side_effect=OSError):
            record("skill", {**self.base, "tool_name": "Skill",
                             "tool_input": {"skill": "japanese-tech-writing"}})
        self.assertEqual(self.state()["skills"], ["japanese-tech-writing"])

    def test_records_when_lock_retry_succeeds(self) -> None:
        # 初回のロック取得に失敗しても、再試行で取れれば排他付きで記録される。
        payload = {**self.base, "tool_input": {"skill": "japanese-tech-writing"}}
        with mock.patch("fcntl.flock", side_effect=[OSError, None, None]):
            self.assertTrue(state_mod.add_skill(payload))
        self.assertEqual(self.state()["skills"], ["japanese-tech-writing"])

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

    def test_preserves_lock_files(self) -> None:
        # cleanup はロックファイルを削除しない。削除の瞬間に旧 inode を待つ
        # プロセスがいると新旧のロックで排他が分裂するため。
        with tempfile.TemporaryDirectory() as tmp:
            original = state_mod.STATE_ROOT
            state_mod.STATE_ROOT = Path(tmp)
            try:
                lock = Path(tmp) / "old.lock"
                lock.write_text("", encoding="utf-8")
                os.utime(lock, (time.time() - 7200, time.time() - 7200))
                state_mod.cleanup()
                self.assertTrue(lock.exists())
            finally:
                state_mod.STATE_ROOT = original


class MergeListsTest(unittest.TestCase):
    def test_union_preserves_concurrent_additions(self) -> None:
        # 無排他時に書き戻す場合も、読み取り時の差分を現在の状態へ和集合で積む。
        # 後勝ちの上書きで他プロセスの追記が消えないことを確認する。
        before = {"written": ["a.md"], "skills": []}
        mutated = {"written": ["a.md", "b.md"], "skills": ["x"]}
        fresh = {"written": ["a.md", "c.md"], "skills": ["y"]}
        merged = state_mod._merge_lists(fresh, before, mutated)
        self.assertEqual(merged["written"], ["a.md", "c.md", "b.md"])
        self.assertEqual(merged["skills"], ["y", "x"])

    def test_union_is_idempotent_for_unchanged_state(self) -> None:
        before = {"written": ["a.md"], "skills": []}
        fresh = {"written": ["a.md", "c.md"], "skills": ["y"]}
        merged = state_mod._merge_lists(fresh, before, before)
        self.assertEqual(merged, fresh)


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


class BaselineTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.doc = Path(self.tmp.name) / "doc.md"
        self.snapshot = Path(self.tmp.name) / gate_mod.STATE_DIR / "doc.md"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def require(self, tool_input: dict, **overrides) -> int:
        payload = {"session_id": f"s-{uuid.uuid4()}", "prompt_id": f"p-{uuid.uuid4()}",
                   "tool_name": "Edit", "tool_input": tool_input, **overrides}
        return run_hook(REQUIRE, [], payload).returncode

    def test_saves_pre_edit_text_once(self) -> None:
        self.doc.write_text("編集前", encoding="utf-8")
        self.assertTrue(gate_mod.baseline(str(self.doc)))
        self.doc.write_text("編集後", encoding="utf-8")
        # 既に記録があれば上書きしない（確認済みの記録や、ターン内の最初の基準を保つ）
        self.assertFalse(gate_mod.baseline(str(self.doc)))
        self.assertEqual(self.snapshot.read_text(encoding="utf-8"), "編集前")
        self.assertEqual((self.snapshot.parent / ".gitignore").read_text(encoding="utf-8"), "*\n")

    def test_skips_new_and_out_of_scope_files(self) -> None:
        self.assertFalse(gate_mod.baseline(str(self.doc)))  # まだ存在しない（新規作成）
        text = Path(self.tmp.name) / "doc.txt"
        text.write_text("本文", encoding="utf-8")
        self.assertFalse(gate_mod.baseline(str(text)))
        self.assertFalse(self.snapshot.parent.exists())

    def test_one_line_addition_counts_only_the_line(self) -> None:
        # 既存文書に 1 行足しても、全文ではなく追加行だけが差分になる
        self.doc.write_text("あいうえお" * 100 + "\n", encoding="utf-8")
        gate_mod.baseline(str(self.doc))
        self.doc.write_text("あいうえお" * 100 + "\nかきく\n", encoding="utf-8")
        self.assertEqual(gate_mod.changed_japanese(self.doc), 3)

    def test_require_hook_saves_baseline_even_when_it_passes(self) -> None:
        # 閾値未満・サブエージェント・スキップ指定でも基準は保存する
        cases = [
            ({"new_string": "x"}, {}),
            ({"new_string": "x"}, {"agent_id": "sub"}),
        ]
        for tool_input, overrides in cases:
            with self.subTest(overrides=overrides):
                self.doc.write_text("編集前", encoding="utf-8")
                if self.snapshot.exists():
                    self.snapshot.unlink()
                code = self.require({"file_path": str(self.doc), **tool_input}, **overrides)
                self.assertEqual(code, 0)
                self.assertEqual(self.snapshot.read_text(encoding="utf-8"), "編集前")

    def test_require_hook_ignores_baseline_failure(self) -> None:
        # 保存先がシンボリックリンクで保存できなくても、書き込み判定は通常どおり進む
        self.doc.write_text("編集前", encoding="utf-8")
        self.snapshot.parent.symlink_to(self.tmp.name)
        self.assertEqual(self.require({"file_path": str(self.doc), "new_string": "x"}), 0)


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

    def test_block_message_defers_options_to_review_rule(self) -> None:
        # 選択肢（5 人・crit・しない）は review.md にだけ書き、指示文は節を指すだけにする
        self.record_write()
        result = subprocess.run(
            [sys.executable, str(GATE), "gate"],
            input=json.dumps(self.base),
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "DOC_REVIEW_THRESHOLD": "1"},
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("review.md の「文書を書いたあとのレビュー確認」", result.stderr)
        self.assertIn("どの選択肢が選ばれた場合も", result.stderr)
        self.assertIn("doc-review.py mark", result.stderr)
        rule = Path(__file__).resolve().parents[1] / "rules" / "review.md"
        self.assertIn("## 文書を書いたあとのレビュー確認", rule.read_text(encoding="utf-8"))

    def test_passes_below_threshold(self) -> None:
        # doc は日本語 7 字なので閾値 8 なら通る
        self.record_write()
        self.assertEqual(self.gate(self.base, threshold="8"), 0)

    def test_passes_on_second_stop(self) -> None:
        self.record_write()
        self.assertEqual(self.gate({**self.base, "stop_hook_active": 1}, threshold="1"), 0)

    def review_question(self, extra: dict | None = None) -> dict:
        return {**self.base, **(extra or {}), "tool_name": "AskUserQuestion",
                "tool_input": {"questions": [{
                    "question": "doc.md をレビューしますか？",
                    "options": [{"label": "5 人のレビュアーで回す"},
                                {"label": "crit で自分で見る"},
                                {"label": "どちらもしない"}],
                }]}}

    def test_passes_after_review_question_in_same_turn(self) -> None:
        # すでにレビュー確認を出したターンでは、同じ確認を再要求しない
        self.record_write()
        record("ask", self.review_question())
        self.assertEqual(self.gate(self.base, threshold="1"), 0)

    def test_unrelated_question_still_blocks(self) -> None:
        self.record_write()
        record("ask", {**self.base, "tool_name": "AskUserQuestion",
                       "tool_input": {"questions": [{
                           "question": "どちらにしますか？",
                           "options": [{"label": "A"}, {"label": "B"}]}]}})
        self.assertEqual(self.gate(self.base, threshold="1"), 2)

    def test_subagent_question_is_not_recorded(self) -> None:
        self.record_write()
        record("ask", self.review_question({"agent_id": "agent-1"}))
        self.assertEqual(self.gate(self.base, threshold="1"), 2)

    def test_question_in_other_turn_does_not_pass(self) -> None:
        self.record_write()
        other = {**self.base, "prompt_id": f"p-{uuid.uuid4()}"}
        record("ask", {**self.review_question(), **other})
        self.assertEqual(self.gate(self.base, threshold="1"), 2)

    def test_passes_on_invalid_input(self) -> None:
        self.assertEqual(self.gate("not json"), 0)

    def test_ignores_out_of_scope_paths(self) -> None:
        self.assertFalse(gate_mod.is_target(Path("/tmp/x.doc-review/doc.md")))
        self.assertFalse(gate_mod.is_target(Path("/tmp/node_modules/doc.md")))
        self.assertFalse(gate_mod.is_target(Path("/tmp/doc.txt")))

    def test_llm_wiki_pages_are_not_targets(self) -> None:
        with tempfile.TemporaryDirectory() as wiki, tempfile.TemporaryDirectory() as other:
            original = gate_mod.LLM_WIKI_ROOT
            gate_mod.LLM_WIKI_ROOT = Path(wiki)
            try:
                inside = Path(wiki) / "Decisions" / "adr.md"
                inside.parent.mkdir()
                inside.write_text("# adr", encoding="utf-8")
                outside = Path(other) / "doc.md"
                outside.write_text("# doc", encoding="utf-8")
                self.assertFalse(gate_mod.is_target(inside))
                self.assertTrue(gate_mod.is_target(outside))
            finally:
                gate_mod.LLM_WIKI_ROOT = original

    def test_fails_open_on_non_dict_payload(self) -> None:
        # JSON として妥当でもトップレベルが配列・null・数値なら判断できないとして通す
        for payload in ("[]", "null", "123"):
            with self.subTest(payload=payload):
                self.assertEqual(self.gate(payload), 0)

    def test_fails_open_without_prompt_id(self) -> None:
        # prompt_id がない Stop hook は、none キーに記録があっても判断できないとして通す
        doc = self.doc
        doc.write_text("あいうえおかきくけこ" * 60, encoding="utf-8")
        record("write", {"session_id": self.base["session_id"], "tool_name": "Write",
                         "tool_input": {"file_path": str(doc)}})
        self.assertEqual(self.gate({"session_id": self.base["session_id"]}), 0)
        # 対比: prompt_id 付きの記録があれば同じ文書で停止する
        record("write", {**self.base, "tool_name": "Write",
                         "tool_input": {"file_path": str(doc)}})
        self.assertEqual(self.gate(self.base), 2)


class MarkTest(unittest.TestCase):
    def setUp(self) -> None:
        self.turn = tempfile.TemporaryDirectory()
        self.doc = Path(self.turn.name) / "doc.md"
        self.doc.write_text("# 本文", encoding="utf-8")

    def tearDown(self) -> None:
        self.turn.cleanup()

    def mark(self, doc: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(GATE), "mark", str(doc)],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_records_snapshot_and_gitignore(self) -> None:
        result = self.mark(self.doc)
        self.assertEqual(result.returncode, 0, result.stderr)
        snapshot = self.doc.parent / gate_mod.STATE_DIR / self.doc.name
        self.assertTrue(snapshot.exists())
        self.assertEqual(snapshot.read_text(encoding="utf-8"), "# 本文")
        ignore = self.doc.parent / gate_mod.STATE_DIR / ".gitignore"
        self.assertEqual(ignore.read_text(encoding="utf-8"), "*\n")

    def test_rejects_symlinked_state_dir(self) -> None:
        outside = Path(self.turn.name) / "outside.md"
        outside.write_text("外部", encoding="utf-8")
        state = self.doc.parent / gate_mod.STATE_DIR
        state.mkdir(exist_ok=True)
        state.rmdir()
        state.symlink_to(outside)
        result = self.mark(self.doc)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(outside.read_text(encoding="utf-8"), "外部")

    def test_rejects_dangling_symlinked_gitignore(self) -> None:
        target = Path(self.turn.name) / "victim.txt"
        state = self.doc.parent / gate_mod.STATE_DIR
        state.mkdir()
        (state / ".gitignore").symlink_to(target)
        result = self.mark(self.doc)
        self.assertEqual(result.returncode, 1)
        # リンクは実体化されず、リンク先にもファイルが作られない
        self.assertTrue((state / ".gitignore").is_symlink())
        self.assertFalse(target.exists())

    def test_replaces_snapshot_symlink_without_following(self) -> None:
        outside = Path(self.turn.name) / "outside.md"
        outside.write_text("外部", encoding="utf-8")
        state = self.doc.parent / gate_mod.STATE_DIR
        state.mkdir()
        (state / self.doc.name).symlink_to(outside)
        result = self.mark(self.doc)
        self.assertEqual(result.returncode, 0, result.stderr)
        # リンク先は保持され、リンク自体が通常ファイルに差し替わる
        self.assertEqual(outside.read_text(encoding="utf-8"), "外部")
        snapshot = state / self.doc.name
        self.assertFalse(snapshot.is_symlink())
        self.assertEqual(snapshot.read_text(encoding="utf-8"), "# 本文")


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
        self.assertIn(("AskUserQuestion", "python3 ~/.claude/hooks/doc-review-state.py ask"),
                      pairs)

    def test_stop_gate_runs(self) -> None:
        self.assertIn(("", "python3 ~/.claude/hooks/doc-review.py gate"),
                      self.commands("Stop"))

    def test_mark_is_allowed(self) -> None:
        self.assertIn("Bash(python3 ~/.claude/hooks/doc-review.py mark:*)",
                      self.settings["permissions"]["allow"])


if __name__ == "__main__":
    unittest.main()
