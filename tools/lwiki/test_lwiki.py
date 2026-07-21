#!/usr/bin/env python3
"""lwiki のブラックボックステスト（標準ライブラリのみ）。

CLI を一時 root に対して実行し、ファイル配置・_index.md/_log.md 更新・
命名規則・エラー処理を検証する。qmd には依存しない（--no-reindex を使う）。

実行: python3 tools/lwiki/test_lwiki.py
"""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "lwiki"

INDEX_TEMPLATE = """# Wiki Index

AI-managed knowledge base. Last updated: 2020-01-01

## Decisions
意思決定ログ（ADR）

- [ADR-001](Decisions/ADR-001-x.md) — 既存

## PRDs
1枚企画書（One Paper PRD）

## Concepts
概念・用語集

## Research
調査

## Sessions
セッションごとの学び

- [既存](sessions/2020-01-01-x.md) — 既存
"""


class LwikiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.root = self.base / "wiki-root"
        self.xdg = self.base / "xdg"
        wiki = self.root / "wiki"
        for sub in ("Decisions", "PRDs", "Concepts", "research", "sessions"):
            (wiki / sub).mkdir(parents=True)
        (wiki / "_index.md").write_text(INDEX_TEMPLATE, encoding="utf-8")
        (wiki / "_log.md").write_text("# Log\n", encoding="utf-8")
        # ADR 採番テスト用に 001 と 003 を置く（次は 004 になるはず）
        (wiki / "Decisions" / "ADR-001-x.md").write_text("", encoding="utf-8")
        (wiki / "Decisions" / "ADR-003-y.md").write_text("", encoding="utf-8")
        self.run_cli("config", "set-root", str(self.root))

    def tearDown(self):
        self.tmp.cleanup()

    def run_cli(self, *args, stdin=None):
        env = dict(os.environ, XDG_CONFIG_HOME=str(self.xdg))
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            input=stdin,
            capture_output=True,
            text=True,
            env=env,
        )

    def index_text(self):
        return (self.root / "wiki" / "_index.md").read_text(encoding="utf-8")

    def log_text(self):
        return (self.root / "wiki" / "_log.md").read_text(encoding="utf-8")

    # ---- config ----
    def test_config_roundtrip(self):
        got = self.run_cli("config", "get")
        self.assertEqual(got.returncode, 0)
        self.assertEqual(got.stdout.strip(), str(self.root))
        path = self.run_cli("config", "path")
        self.assertIn("llm-wiki/config.toml", path.stdout)

    # ---- add: decision ----
    def test_add_decision_autonumber_and_frontmatter(self):
        r = self.run_cli(
            "add", "--category", "decision", "--title", "Test Decision",
            "--slug", "test-decision", "--summary", "テスト用", "--no-reindex",
            "--stdin", stdin="本文サンプル",
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        adr = self.root / "wiki" / "Decisions" / "ADR-004-test-decision.md"
        self.assertTrue(adr.exists(), "ADR は 004 に自動採番されるべき")
        content = adr.read_text(encoding="utf-8")
        self.assertIn("status: draft", content)
        self.assertIn("models_considered: []", content)
        self.assertIn("# Test Decision", content)
        self.assertIn("本文サンプル", content)
        # index/log 反映
        self.assertIn("(Decisions/ADR-004-test-decision.md) — テスト用", self.index_text())
        self.assertIn("add | Test Decision", self.log_text())
        # Last updated が更新される
        self.assertNotIn("Last updated: 2020-01-01", self.index_text())

    # ---- add: concept (空セクションへの初挿入で空行が入る) ----
    def test_add_concept_blank_line_after_description(self):
        r = self.run_cli(
            "add", "--category", "concept", "--title", "RAG", "--slug", "rag",
            "--summary", "検索拡張生成", "--no-reindex",
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue((self.root / "wiki" / "Concepts" / "rag.md").exists())
        self.assertIn("概念・用語集\n\n- [RAG](Concepts/rag.md)", self.index_text())

    # ---- add: session は日付ファイル名 ----
    def test_add_session_dated_filename(self):
        r = self.run_cli(
            "add", "--category", "session", "--title", "Visit", "--slug", "visit-note",
            "--summary", "要約", "--no-reindex",
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        files = list((self.root / "wiki" / "sessions").glob("*-visit-note.md"))
        self.assertEqual(len(files), 1)
        self.assertRegex(files[0].name, r"^\d{4}-\d{2}-\d{2}-visit-note\.md$")

    # ---- add: 非ASCIIタイトル + slug 無し → エラー ----
    def test_add_nonascii_without_slug_errors(self):
        r = self.run_cli(
            "add", "--category", "concept", "--title", "日本語タイトル",
            "--summary", "x", "--no-reindex",
        )
        self.assertEqual(r.returncode, 2)
        self.assertIn("slug", r.stderr)

    # ---- add: 重複は上書きしない ----
    def test_add_duplicate_refused(self):
        args = ("add", "--category", "concept", "--title", "Dup", "--slug", "dup",
                "--summary", "s", "--no-reindex")
        self.assertEqual(self.run_cli(*args).returncode, 0)
        dup = self.run_cli(*args)
        self.assertEqual(dup.returncode, 2)
        self.assertIn("既に存在", dup.stderr)

    # ---- read: root 相対 / wiki 相対フォールバック ----
    def test_read_resolves_paths(self):
        r1 = self.run_cli("read", "wiki/_index.md")
        self.assertEqual(r1.returncode, 0)
        self.assertIn("Wiki Index", r1.stdout)
        # wiki/ を省いても解決する
        r2 = self.run_cli("read", "_index.md")
        self.assertEqual(r2.returncode, 0)
        self.assertIn("Wiki Index", r2.stdout)
        r3 = self.run_cli("read", "does/not/exist.md")
        self.assertEqual(r3.returncode, 2)

    # ---- log 追記 ----
    def test_log_appends(self):
        r = self.run_cli("log", "lint | チェック実行")
        self.assertEqual(r.returncode, 0)
        self.assertIn("lint | チェック実行", self.log_text())

    # ---- root 未設定時のエラー ----
    def test_missing_root_errors(self):
        env = dict(os.environ, XDG_CONFIG_HOME=str(self.base / "empty-xdg"))
        r = subprocess.run(
            [sys.executable, str(SCRIPT), "add", "--category", "concept",
             "--title", "X", "--slug", "x", "--summary", "s", "--no-reindex"],
            capture_output=True, text=True, env=env,
        )
        self.assertEqual(r.returncode, 2)
        self.assertIn("root", r.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
