#!/usr/bin/env python3
"""Validate a review result against the shared output contract."""

import json
import sys
from pathlib import Path

SEVERITIES = {"critical", "major", "minor"}
REQUIRED_FINDING_KEYS = {
    "location", "category", "severity", "confidence",
    "problem", "evidence", "suggestion",
}


def fail(message: str) -> None:
    print(f"invalid review output: {message}", file=sys.stderr)
    raise SystemExit(1)


def validate(value: object) -> None:
    if not isinstance(value, dict):
        fail("root must be an object")
    if not isinstance(value.get("reviewer"), str):
        fail("reviewer must be a string")
    findings = value.get("findings")
    if not isinstance(findings, list):
        fail("findings must be an array")
    for index, finding in enumerate(findings):
        if not isinstance(finding, dict):
            fail(f"findings[{index}] must be an object")
        missing = REQUIRED_FINDING_KEYS - finding.keys()
        if missing:
            fail(f"findings[{index}] is missing: {', '.join(sorted(missing))}")
        for key in REQUIRED_FINDING_KEYS - {"severity", "confidence"}:
            if not isinstance(finding[key], str):
                fail(f"findings[{index}].{key} must be a string")
        if finding["severity"] not in SEVERITIES:
            fail(f"findings[{index}].severity must be critical, major, or minor")
        confidence = finding["confidence"]
        if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
            fail(f"findings[{index}].confidence must be a number")
        if not 0 <= confidence <= 1:
            fail(f"findings[{index}].confidence must be between 0 and 1")
        if "source" in finding and not isinstance(finding["source"], str):
            fail(f"findings[{index}].source must be a string")


def main() -> None:
    if len(sys.argv) > 2:
        fail("usage: validate-output.py [result.json]")
    try:
        text = Path(sys.argv[1]).read_text() if len(sys.argv) == 2 else sys.stdin.read()
        validate(json.loads(text))
    except (OSError, json.JSONDecodeError) as error:
        fail(str(error))
    print("valid review output")


if __name__ == "__main__":
    main()
