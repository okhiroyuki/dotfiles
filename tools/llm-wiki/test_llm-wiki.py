#!/usr/bin/env python3
"""llm-wiki のブラックボックステスト（標準ライブラリのみ）。

CLI を一時 root に対して実行し、ファイル配置・_index.md/_log.md 更新・
命名規則・エラー処理を検証する。qmd には依存しない（--no-reindex を使う）。

実行: python3 tools/llm-wiki/test_llm-wiki.py
"""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "llm-wiki"

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

    # ---- config set-root をパス無しで実行してもクラッシュしない ----
    def test_config_set_root_without_path(self):
        r = self.run_cli("config", "set-root")
        self.assertEqual(r.returncode, 2)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("パス", r.stderr)

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

    # ---- config: 特殊文字を含む root がラウンドトリップする ----
    def test_config_roundtrip_special_chars(self):
        weird = self.base / 'a"b\\c dir'  # 引用符・バックスラッシュ・空白を含む
        weird.mkdir()
        r = self.run_cli("config", "set-root", str(weird))
        self.assertEqual(r.returncode, 0, r.stderr)
        got = self.run_cli("config", "get")
        self.assertEqual(got.stdout.strip(), str(weird))

    # ---- add: --status で decision の frontmatter status を指定できる ----
    def test_add_decision_status_option(self):
        r = self.run_cli(
            "add", "--category", "decision", "--title", "Accepted One",
            "--slug", "acc", "--status", "accepted", "--no-reindex",
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        adr = self.root / "wiki" / "Decisions" / "ADR-004-acc.md"
        self.assertIn("status: accepted", adr.read_text(encoding="utf-8"))

    # ---- add: --status は decision 以外では無視され警告される ----
    def test_add_status_ignored_for_non_decision(self):
        r = self.run_cli(
            "add", "--category", "concept", "--title", "C", "--slug", "c",
            "--status", "accepted", "--no-reindex",
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("無視", r.stderr)
        self.assertNotIn("status:", (self.root / "wiki" / "Concepts" / "c.md").read_text(encoding="utf-8"))

    # ---- add: --dry-run は何も書き込まない ----
    def test_add_dry_run_writes_nothing(self):
        before_index, before_log = self.index_text(), self.log_text()
        r = self.run_cli(
            "add", "--category", "concept", "--title", "Preview", "--slug", "preview",
            "--summary", "s", "--no-reindex", "--dry-run",
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("[dry-run]", r.stdout)
        self.assertFalse((self.root / "wiki" / "Concepts" / "preview.md").exists())
        self.assertEqual(self.index_text(), before_index)
        self.assertEqual(self.log_text(), before_log)

    # ---- add: qmd 不在時は作成後に再インデックス案内を出す ----
    def test_add_reindex_hint_when_qmd_missing(self):
        env = dict(os.environ, XDG_CONFIG_HOME=str(self.xdg), PATH="/nonexistent-xyz")
        r = subprocess.run(
            [sys.executable, str(SCRIPT), "add", "--category", "concept",
             "--title", "NoQmd", "--slug", "noqmd", "--summary", "s"],
            capture_output=True, text=True, env=env,
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        # ページは作成される
        self.assertTrue((self.root / "wiki" / "Concepts" / "noqmd.md").exists())
        # 未インデックスの案内が出る
        self.assertIn("検索インデックスは未更新", r.stdout)

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

    # ---- add: 存在しない --body-file はトレースバックせずエラー終了 ----
    def test_add_missing_body_file_errors_cleanly(self):
        r = self.run_cli(
            "add", "--category", "concept", "--title", "NoBody", "--slug", "nobody",
            "--summary", "s", "--body-file", str(self.base / "does-not-exist.md"),
            "--no-reindex",
        )
        self.assertEqual(r.returncode, 2)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("body-file", r.stderr)
        # 本文ファイルは作られない
        self.assertFalse((self.root / "wiki" / "Concepts" / "nobody.md").exists())

    # ---- add: --body-file と --stdin の同時指定は排他エラー ----
    def test_add_body_file_and_stdin_mutually_exclusive(self):
        r = self.run_cli(
            "add", "--category", "concept", "--title", "Both", "--slug", "both",
            "--summary", "s", "--body-file", "/tmp/x.md", "--stdin", "--no-reindex",
            stdin="本文",
        )
        self.assertEqual(r.returncode, 2)
        self.assertFalse((self.root / "wiki" / "Concepts" / "both.md").exists())

    # ---- add: セクション欠落時はファイルを作らず index/log も変えない ----
    def test_add_missing_section_leaves_no_orphan(self):
        # PRDs セクションを含まない _index.md に差し替える
        idx = self.root / "wiki" / "_index.md"
        idx.write_text("# Wiki Index\n\nLast updated: 2020-01-01\n\n## Concepts\n概念\n",
                       encoding="utf-8")
        before_index = self.index_text()
        before_log = self.log_text()
        r = self.run_cli(
            "add", "--category", "prd", "--title", "Orphan", "--slug", "orphan",
            "--summary", "s", "--no-reindex",
        )
        self.assertEqual(r.returncode, 2)
        self.assertIn("セクション", r.stderr)
        # 本文ファイルが残っていない（孤児化しない）
        self.assertFalse((self.root / "wiki" / "PRDs" / "orphan.md").exists())
        # index/log は無変更
        self.assertEqual(self.index_text(), before_index)
        self.assertEqual(self.log_text(), before_log)

    # ---- add: --body-file 正常系 ----
    def test_add_with_body_file(self):
        bf = self.base / "body.md"
        bf.write_text("ファイル本文\n", encoding="utf-8")
        r = self.run_cli(
            "add", "--category", "concept", "--title", "FromFile", "--slug", "fromfile",
            "--summary", "s", "--body-file", str(bf), "--no-reindex",
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        content = (self.root / "wiki" / "Concepts" / "fromfile.md").read_text(encoding="utf-8")
        self.assertIn("ファイル本文", content)

    # ---- list: カテゴリ別に一覧し、タイトルも表示する ----
    def test_list_groups_and_shows_titles(self):
        self.run_cli("add", "--category", "concept", "--title", "RAG", "--slug", "rag",
                     "--summary", "s", "--no-reindex")
        self.run_cli("add", "--category", "concept", "--title", "HPKI", "--slug", "hpki",
                     "--summary", "s", "--no-reindex")
        self.run_cli("add", "--category", "prd", "--title", "One Pager", "--slug", "one",
                     "--summary", "s", "--no-reindex")
        r = self.run_cli("list")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("## Concepts", r.stdout)
        self.assertIn("- Concepts/rag.md — RAG", r.stdout)
        self.assertIn("- Concepts/hpki.md — HPKI", r.stdout)
        self.assertIn("## PRDs", r.stdout)
        self.assertIn("- PRDs/one.md — One Pager", r.stdout)

    # ---- list --category: 指定カテゴリのみ ----
    def test_list_filtered_by_category(self):
        self.run_cli("add", "--category", "concept", "--title", "RAG", "--slug", "rag",
                     "--summary", "s", "--no-reindex")
        self.run_cli("add", "--category", "prd", "--title", "One Pager", "--slug", "one",
                     "--summary", "s", "--no-reindex")
        r = self.run_cli("list", "--category", "concept")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("Concepts/rag.md", r.stdout)
        self.assertNotIn("PRDs/one.md", r.stdout)

    # ---- list: 対象が空ならその旨を出す（research は setUp で空） ----
    def test_list_empty(self):
        r = self.run_cli("list", "--category", "research")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("ページがありません", r.stdout)

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
