#!/usr/bin/env python3
"""Regression tests for the shared review-output validator."""

import json
import subprocess
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate-output.py")


def finding() -> dict[str, object]:
    return {
        "location": "example.py:1",
        "category": "correctness",
        "severity": "minor",
        "confidence": 0,
        "problem": "problem",
        "evidence": "evidence",
        "impact": "impact",
        "suggestion": "suggestion",
    }


def validate(value: dict[str, object]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=json.dumps(value),
        capture_output=True,
        text=True,
        check=False,
    )


class ValidateOutputTest(unittest.TestCase):
    def test_validates_confidence_boundaries(self) -> None:
        for confidence in (0, 1):
            with self.subTest(confidence=confidence):
                result = validate({"reviewer": "tests", "findings": [
                    {**finding(), "confidence": confidence},
                ]})
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_missing_impact(self) -> None:
        invalid = finding()
        del invalid["impact"]
        result = validate({"reviewer": "tests", "findings": [invalid]})
        self.assertNotEqual(result.returncode, 0)

    def test_rejects_non_string_test_case(self) -> None:
        result = validate({"reviewer": "tests", "findings": [
            {**finding(), "testCase": ["not", "a", "string"]},
        ]})
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
