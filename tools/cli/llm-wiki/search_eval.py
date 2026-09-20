#!/usr/bin/env python3
"""llm-wiki search の品質eval（ゴールドセット方式）。

search_evals.json の各クエリを実際の root(設定済み)に対して
`llm-wiki search` で実行し、top-1 が正解ページと一致するか(的中率)、
ノイズケースでは top1-top2 のスコア差(平たさ)を報告する。

実行: python3 tools/cli/llm-wiki/search_eval.py [--json]
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
GOLD = BASE / "search_evals.json"


def run_search(query: str, top_k: int = 10):
    proc = subprocess.run(
        ["llm-wiki", "search", query, "--top-k", str(top_k)],
        capture_output=True, text=True,
    )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        sys.stderr.write("search 出力がJSONではありません:\n%s\n%s\n" % (proc.stdout, proc.stderr))
        sys.exit(2)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="機械可読なJSONで出力する")
    ap.add_argument("--flat-gap", type=float, default=0.05,
                    help="top1-top2 スコア差がこの比率以下なら「フラット」とみなす")
    args = ap.parse_args()

    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    hits, noise_cases = [], []
    rows = []

    for q in gold["queries"]:
        results = run_search(q["query"])["results"]
        if not results:
            rows.append({"query": q["query"], "status": "no-results"})
            if q["expected"] is None:
                noise_cases.append(True)
            else:
                hits.append(False)
            continue

        top1, top2 = results[0], (results[1] if len(results) > 1 else None)
        if q["expected"] is None:
            gap = (top1["score"] - top2["score"]) if top2 else 1.0
            gap_ratio = gap / top1["score"] if top1["score"] else 1.0
            flat = gap_ratio <= args.flat_gap
            rows.append({
                "query": q["query"], "status": "noise-check",
                "top1": Path(top1["file_path"]).name, "top1_score": round(top1["score"], 4),
                "top2": Path(top2["file_path"]).name if top2 else None,
                "gap_ratio": round(gap_ratio, 3), "flat": flat,
            })
            noise_cases.append(not flat)
        else:
            ok = Path(top1["file_path"]) == Path(q["expected"])
            rows.append({
                "query": q["query"], "status": "hit-check",
                "expected": Path(q["expected"]).name,
                "actual": Path(top1["file_path"]).name, "top1_score": round(top1["score"], 4),
                "pass": ok,
            })
            hits.append(ok)

    hit_rate = sum(hits) / len(hits) if hits else float("nan")
    clean_rate = sum(noise_cases) / len(noise_cases) if noise_cases else float("nan")

    if args.json:
        print(json.dumps({"hit_rate_hitcheck": hit_rate, "distinct_rate_noisecheck": clean_rate,
                          "rows": rows}, ensure_ascii=False, indent=2))
    else:
        for r in rows:
            print(json.dumps(r, ensure_ascii=False))
        print("-" * 60)
        print("正解ケース top-1 的中率 : %d/%d = %s" % (
            sum(hits), len(hits), "%.1f%%" % (100 * hit_rate) if hits == hits else "n/a"))
        print("ノイズケースの自動識別率(フラットでない): %d/%d" % (
            sum(noise_cases), len(noise_cases)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
