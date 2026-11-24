"""semble 用に、正規化を有効にした bekko モデルを作る。

bekko(hotchpotch/bekko-static-embedding-v1)の埋め込みは float16 で、設定は normalize=false。
semble はクエリの埋め込みを float16 のまま vicinity の normalize に渡すため、ノルムが 256 を
超えるクエリ(1〜4 トークンの短い検索語の多く)で二乗和が float16 の上限 65504 を超えて inf になる。
inf で割ったクエリベクトルは全要素 0 になり、意味検索の類似度が全文書で 0 になる
(numpy の "overflow encountered in reduce" 警告はこのとき出る)。

semble は encode に normalize を渡さないため、model2vec はモデル設定の normalize に従う。
normalize=true で保存し直すと、model2vec が float32 で正規化してから返すので、semble 側の
計算は単位ベクトルに対して行われ、オーバーフローしない。重みの値は変えない。
モデルカードが推奨する使い方(normalize_embeddings=True)とも一致する。

元のファイルとは重みの名前が違うため、config.json の書き換えだけでは読み込めない。
model2vec で読み込んで保存し直す。

使い方: uv run --no-project --with semble==<pin> python build-semble-model.py <出力ディレクトリ>
出力先にモデルがあれば何もしない。
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

SOURCE_MODEL = "hotchpotch/bekko-static-embedding-v1"


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <output-dir>", file=sys.stderr)
        return 2
    out = Path(sys.argv[1]).expanduser()
    if (out / "config.json").exists():
        return 0

    from model2vec import StaticModel

    model = StaticModel.from_pretrained(SOURCE_MODEL, normalize=True, force_download=False)

    # 途中で失敗しても半端な出力を残さないよう、一時ディレクトリに保存してから置き換える。
    tmp = out.with_name(out.name + ".tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    model.save_pretrained(tmp, model_name=SOURCE_MODEL)
    tmp.rename(out)
    print(f"{out} に作成しました", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
