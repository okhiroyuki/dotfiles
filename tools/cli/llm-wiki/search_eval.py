#!/usr/bin/env python3
"""llm-wiki search の品質eval（ゴールドセット方式）。

評価セットの各クエリを実際の root(設定済み)に対して
`llm-wiki search` で実行し、top-1 が正解ページと一致するか(的中率)、
正解ページが top-k の何位にあるか、
ノイズケースでは top1-top2 のスコア差(平たさ)を報告する。

評価セットは次の順で探す。wiki の中身はマシンごとに違うため、
マシン固有の評価セットは wiki 側(dotfiles の管理外)に置く。
  1. --gold で指定したファイル
  2. <root>/search_evals.json
  3. このスクリプトと同じ場所の search_evals.json
正解ページが root 配下に存在しないケースは「対象外」として的中率に数えない。

実行: python3 tools/cli/llm-wiki/search_eval.py [--json] [--gold <path>]
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
BUNDLED_GOLD = BASE / "search_evals.json"
GOLD_NAME = "search_evals.json"
TOP_K = 10


def get_root() -> Path:
    proc = subprocess.run(["llm-wiki", "config", "get"], capture_output=True, text=True)
    if proc.returncode != 0 or not proc.stdout.strip():
        sys.stderr.write("llm-wiki の root を取得できません:\n%s\n" % proc.stderr)
        sys.exit(2)
    return Path(proc.stdout.strip()).expanduser()


def resolve_gold(arg, root: Path) -> Path:
    if arg:
        return Path(arg).expanduser()
    local = root / GOLD_NAME
    return local if local.is_file() else BUNDLED_GOLD


def run_search(query: str, top_k: int = TOP_K):
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
    ap.add_argument("--gold", help="評価セットのパス（既定: <root>/search_evals.json、なければ同梱ファイル）")
    args = ap.parse_args()

    root = get_root()
    gold_path = resolve_gold(args.gold, root)
    try:
        gold = json.loads(gold_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        sys.stderr.write("エラー: 評価セットが見つかりません: %s\n" % gold_path)
        return 2
    except json.JSONDecodeError as e:
        sys.stderr.write("エラー: 評価セットが JSON として読めません: %s (%s)\n" % (gold_path, e))
        return 2
    hits, in_topk, noise_cases = [], [], []
    rows, skipped = [], []
    by_kind = {}  # kind -> [(top1 的中, top-k 到達)]

    for q in gold["queries"]:
        if q["expected"] is not None and not (root / q["expected"]).is_file():
            # 別マシンの wiki を前提にしたケース。ここでは測れないので数えない
            skipped.append(q["query"])
            rows.append({"query": q["query"], "status": "skipped",
                         "reason": "正解ページが root 配下にない: %s" % q["expected"]})
            continue
        results = run_search(q["query"])["results"]
        if not results:
            rows.append({"query": q["query"], "status": "no-results"})
            if q["expected"] is None:
                noise_cases.append(True)
            else:
                hits.append(False)
                in_topk.append(False)
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
            # file_path は検索範囲起点（wiki/ のときは Decisions/... ）で返るため、
            # root 相対の expected とは名前だけで比べる。ページ名はこの wiki 内で一意。
            names = [Path(r["file_path"]).name for r in results]
            expected = Path(q["expected"]).name
            ok = names[0] == expected
            # 同じページが複数チャンクで返るので、最初に現れた順位を採る
            rank = names.index(expected) + 1 if expected in names else None
            rows.append({
                "query": q["query"], "status": "hit-check",
                "expected": expected,
                "actual": names[0], "top1_score": round(top1["score"], 4),
                "rank": rank, "pass": ok,
            })
            if q.get("kind"):
                rows[-1]["kind"] = q["kind"]
                by_kind.setdefault(q["kind"], []).append((ok, rank is not None))
            hits.append(ok)
            in_topk.append(rank is not None)

    hit_rate = sum(hits) / len(hits) if hits else float("nan")
    topk_rate = sum(in_topk) / len(in_topk) if in_topk else float("nan")
    clean_rate = sum(noise_cases) / len(noise_cases) if noise_cases else float("nan")

    if args.json:
        print(json.dumps({"gold": str(gold_path), "root": str(root),
                          "hit_rate_hitcheck": hit_rate, "topk_rate_hitcheck": topk_rate,
                          "distinct_rate_noisecheck": clean_rate,
                          "skipped": len(skipped), "rows": rows}, ensure_ascii=False, indent=2))
    else:
        print("評価セット: %s" % gold_path)
        print("root      : %s" % root)
        for r in rows:
            print(json.dumps(r, ensure_ascii=False))
        print("-" * 60)
        print("正解ケース top-1 的中率      : %d/%d = %s" % (sum(hits), len(hits), fmt_rate(hit_rate)))
        print("正解ケース top-%d 内の到達率 : %d/%d = %s" % (TOP_K, sum(in_topk), len(in_topk), fmt_rate(topk_rate)))
        print("ノイズケースの自動識別率(フラットでない): %d/%d" % (
            sum(noise_cases), len(noise_cases)))
        for kind, rs in by_kind.items():
            print("  %s: top-1 %d/%d, top-%d 到達 %d/%d" % (
                kind, sum(r[0] for r in rs), len(rs), TOP_K, sum(r[1] for r in rs), len(rs)))
        if skipped:
            print("対象外（正解ページがこの wiki にない）: %d 件" % len(skipped))
    sys.stdout.flush()
    if skipped and not hits:
        sys.stderr.write("警告: 正解ケースがすべて対象外です。評価セット %s はこの wiki に合っていません。%s\n"
                         % (gold_path, next_step_hint(gold_path, root)))
        return 1
    return 0


def next_step_hint(gold_path: Path, root: Path) -> str:
    local = root / GOLD_NAME
    if not local.is_file():
        return "%s を作ってください。" % local
    if gold_path.resolve() == local.resolve():
        return "expected のパスが root 相対で実在するページを指しているか見直してください。"
    return "この wiki 用の評価セット %s があります。--gold を外して実行してください。" % local


def fmt_rate(rate: float) -> str:
    return "n/a" if rate != rate else "%.1f%%" % (100 * rate)


if __name__ == "__main__":
    sys.exit(main())
