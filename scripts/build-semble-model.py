"""semble 用に bekko の埋め込み行列を定数倍で縮めたモデルを作る。

bekko(hotchpotch/bekko-static-embedding-v1)の埋め込みは float16 で、正規化されていない。
semble はクエリの埋め込みを float16 のまま vicinity の normalize に渡すため、ノルムが 256 を
超えるクエリ(1〜4 トークンの短い検索語の多く)で二乗和が float16 の上限 65504 を超えて inf になる。
inf で割ったクエリベクトルは全要素 0 になり、意味検索の類似度が全文書で 0 になる
(numpy の "overflow encountered in reduce" 警告はこのとき出る)。

行列全体を 2 の累乗で割っても、コサイン類似度と検索順位は変わらない。16 で割ると行ノルムの
最大が約 182 になり、行の平均であるクエリベクトルのノルムも 256 を超えない。
float16 のまま保存するのでサイズは元と同じ(float32 化すると倍になる)。

使い方: uv run --no-project --with semble==<pin> python build-semble-model.py <出力ディレクトリ>
出力先にモデルがあれば何もしない。
"""

from __future__ import annotations

import sys
from pathlib import Path

SOURCE_MODEL = "hotchpotch/bekko-static-embedding-v1"
SCALE = 16
# float16 の二乗和が上限を超えない行ノルムの上限(sqrt(65504) ≈ 255.9)。
NORM_LIMIT = 255.0


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <output-dir>", file=sys.stderr)
        return 2
    out = Path(sys.argv[1]).expanduser()
    if (out / "config.json").exists():
        return 0

    import numpy as np
    from model2vec import StaticModel

    model = StaticModel.from_pretrained(SOURCE_MODEL, force_download=False)
    scaled = model.embedding / np.asarray(SCALE, dtype=model.embedding.dtype)
    max_norm = float(np.linalg.norm(scaled.astype(np.float32), axis=1).max())
    if max_norm >= NORM_LIMIT:
        print(f"縮めた後も行ノルムの最大が {max_norm:.1f} あり、オーバーフローを防げない", file=sys.stderr)
        return 1
    model.embedding = scaled

    # 途中で失敗しても半端な出力を残さないよう、一時ディレクトリに保存してから置き換える。
    tmp = out.with_name(out.name + ".tmp")
    model.save_pretrained(tmp, model_name=SOURCE_MODEL)
    tmp.rename(out)
    print(f"{out} に作成しました(行ノルムの最大 {max_norm:.1f})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
