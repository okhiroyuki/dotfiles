"""semble の埋め込みモデルの検索精度を、dotfiles 自体を検索対象にして手元で確かめる。

主な目的は、bekko の float16 オーバーフロー(build-semble-model.py の冒頭を参照)の再発検出である。
オーバーフローは 1〜4 トークンの短いクエリで起き、意味検索の類似度が全件 0 になる。
wiki の eval セットはマシンごとに中身が違い dotfiles に置けないため、こちらは dotfiles の
ファイルを正解にした短いクエリだけで測る。CI では実行しない(モデルが約 400MB あるため)。

実行: mise run eval:semble-model [-- --baseline]
  対象モデルは SEMBLE_MODEL_NAME(zshenv が設定する値)。--baseline を付けると、
  比較用に元の bekko(HF のモデル名)でも同じクエリを回す。

判定: 対象モデルでオーバーフロー警告が 1 件でも出るか、ローカルモデルの設定が
normalize=true でなければ終了コード 1 を返す。的中率は報告するだけで合否に使わない。
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SELF = Path(__file__).resolve().relative_to(REPO).as_posix()
BASELINE_MODEL = "hotchpotch/bekko-static-embedding-v1"
TOP_K = 10
# 末尾が / の正解はディレクトリ配下のどれかに当たれば正解とする。
CASES: list[tuple[str, list[str]]] = [
    ("hook", ["claude/hooks/"]),
    ("Homebrew", ["zsh/configs/homebrew.zsh"]),
    ("textlint", ["claude/hooks/textlint-ai-words.sh", "host-private/config/opencode/plugins/textlint.ts"]),
    ("semble pin", ["zsh/configs/semble-pin.zsh"]),
    ("MCP 登録", ["scripts/install-semble.sh"]),
    ("文書レビュー", ["claude/hooks/doc-review.py", "host-private/config/opencode/plugins/doc-review.ts"]),
    ("評価セット", ["tools/cli/llm-wiki/search_eval.py"]),
    ("埋め込み 正規化", ["scripts/build-semble-model.py"]),
    ("Confluence 書き込み", ["claude/hooks/confluence-write-guard.py"]),
    ("コミットメッセージ 検証", ["claude/hooks/validate-commit-message.py"]),
]


def matches(path: str, expected: list[str]) -> bool:
    return any(path.startswith(e) if e.endswith("/") else path == e for e in expected)


def run_model(model: str) -> dict:
    semble = Path(sys.executable).with_name("semble")
    # 普段の検索キャッシュに触れず、毎回インデックスを作り直して測る。
    env = dict(os.environ, SEMBLE_MODEL_NAME=model, SEMBLE_CACHE_LOCATION=tempfile.mkdtemp())
    rows, overflow, top1, topk = [], 0, 0, 0
    for query, expected in CASES:
        proc = subprocess.run(
            # 同じファイルの複数チャンクと自分自身を除いても TOP_K 件残るよう多めに取る。
            [str(semble), "search", query, str(REPO), "--top-k", str(TOP_K * 3)],
            capture_output=True, text=True, env=env,
        )
        if proc.returncode != 0:
            sys.stderr.write(f"semble search が失敗しました({query}):\n{proc.stderr}\n")
            sys.exit(2)
        # 検索結果の本文に "overflow" が含まれることがあるので、警告は stderr だけで判定する。
        warned = "overflow encountered" in proc.stderr
        files: list[str] = []
        for r in json.loads(proc.stdout)["results"]:
            # このファイルはクエリ文字列を含むので語の一致で上位に来る。結果から除く。
            if r["file_path"] == SELF:
                continue
            if r["file_path"] not in files:
                files.append(r["file_path"])
        files = files[:TOP_K]
        rank = next((i for i, f in enumerate(files, 1) if matches(f, expected)), None)
        overflow += warned
        top1 += rank == 1
        topk += rank is not None
        rows.append((query, rank, warned, files[0] if files else "-"))
    return {"rows": rows, "overflow": overflow, "top1": top1, "topk": topk}


def check_config(model: str) -> str | None:
    """ローカルモデルなら normalize=true かを確かめ、問題があれば理由を返す。"""
    config = Path(model).expanduser() / "config.json"
    if not config.is_file():
        return None  # HF のモデル名。設定は確かめない
    if json.loads(config.read_text(encoding="utf-8")).get("normalize") is not True:
        return f"{config} の normalize が true ではない"
    return None


def report(model: str, result: dict) -> None:
    print(f"== {model}")
    for query, rank, warned, top in result["rows"]:
        mark = " overflow" if warned else ""
        print(f"  {query:<16} 正解の順位={rank if rank else '-':<3} 1位={top}{mark}")
    n = len(CASES)
    print(f"  1 位が正解 {result['top1']}/{n}、上位 {TOP_K} 件に正解 {result['topk']}/{n}、"
          f"オーバーフロー警告 {result['overflow']}/{n}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", action="store_true", help=f"比較用に {BASELINE_MODEL} でも回す")
    args = ap.parse_args()

    model = os.environ.get("SEMBLE_MODEL_NAME")
    if not model:
        sys.stderr.write("SEMBLE_MODEL_NAME が未設定です(zshenv を読み込んだシェルで実行してください)\n")
        return 2

    failures = []
    if problem := check_config(model):
        failures.append(problem)
    result = run_model(model)
    report(model, result)
    if result["overflow"]:
        failures.append(f"オーバーフロー警告が {result['overflow']} 件出た")

    if args.baseline and model != BASELINE_MODEL:
        report(BASELINE_MODEL, run_model(BASELINE_MODEL))

    for f in failures:
        print(f"NG: {f}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
