#!/usr/bin/env python3
"""confluence-write-guard.py の回帰テスト。"""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

HOOK = Path(__file__).parent / "confluence-write-guard.py"
SETTINGS = Path(__file__).parent.parent.parent / "host-private" / "claude" / "settings.json"


def decision(command: str, tool: str = "Bash") -> str | None:
    payload = {"tool_name": tool, "tool_input": {"command": command}}
    r = subprocess.run(
        [sys.executable, str(HOOK)],
        input=json.dumps(payload), capture_output=True, text=True, check=False,
    )
    assert r.returncode == 0, r.stderr
    if not r.stdout.strip():
        return None
    return json.loads(r.stdout)["hookSpecificOutput"]["permissionDecision"]


READS = [
    "confluence get 123456789",
    "confluence get 123456789 --format markdown > /tmp/p.md",
    "confluence search 'リリース計画'",
    "confluence history 123456789",
    "confluence syntax table",
    "confluence user search okada",
    "confluence comment list 123456789",
    "confluence label list 123456789",
    "confluence attach list 123456789",
    "confluence folder get 987",
    "confluence auth status",
    "confluence config show",
    "confluence --help",
    "confluence create --help",
    "confluence",
    "cd /tmp && confluence get 1 | head -20",
    "rtk grep confluence README.md",
    "grep -rn 'confluence create' docs/",
    "echo 'confluence edit 1 は書き込み'",
    "git commit -m 'docs: confluence create の手順を追記'",
    "ls ~/confluence",
]

WRITES = [
    "confluence create --space DP --title t --file a.md",
    "confluence edit 123456789 --file a.md",
    "confluence comment create 123 --body hi",
    "confluence comment edit 456 --body hi",
    "confluence label add 123 foo",
    "confluence label remove 123 foo",
    "confluence attach add 123 ./a.png",
    "confluence folder create --title x",
    "confluence folder delete 987",
    "confluence move 1 2",
    "confluence sync ./docs",
    "confluence brand-new-subcommand 1",
    "confluence --space DP create",
    "cd /tmp && confluence edit 1 --file a.md",
    "confluence get 1 > a.md; confluence edit 1 --file a.md",
    "cd /tmp\nconfluence edit 1 --file a.md",
    "FOO=1 confluence create --file a.md",
    "rtk confluence edit 1",
    "env FOO=1 confluence edit 1",
    "/Users/x/Library/pnpm/bin/confluence edit 1",
    "bash -c 'confluence edit 1 --file a.md'",
    "echo `confluence edit 1`",
    "echo $(confluence create --file a.md)",
    "ls *.md | xargs -n1 confluence create --file",
    "confluence edit 1 --title 'unterminated",
]


class ConfluenceWriteGuardTest(unittest.TestCase):
    def test_reads_pass(self):
        for cmd in READS:
            with self.subTest(cmd=cmd):
                self.assertIsNone(decision(cmd))

    def test_writes_ask(self):
        for cmd in WRITES:
            with self.subTest(cmd=cmd):
                self.assertEqual(decision(cmd), "ask")

    def test_other_tools_ignored(self):
        self.assertIsNone(decision("confluence edit 1", tool="Write"))

    def test_broken_stdin_fails_open(self):
        r = subprocess.run([sys.executable, str(HOOK)], input="not json",
                           capture_output=True, text=True, check=False)
        self.assertEqual((r.returncode, r.stdout), (0, ""))

    def test_registered_in_settings(self):
        hooks = json.loads(SETTINGS.read_text())["hooks"]["PreToolUse"]
        commands = [h["command"] for e in hooks if e.get("matcher") == "Bash" for h in e["hooks"]]
        self.assertIn("python3 ~/.claude/hooks/confluence-write-guard.py", commands)


if __name__ == "__main__":
    unittest.main()
