#!/usr/bin/env python3
"""ryuzee.com のブログ一覧を全ページ巡回し、references/index.tsv を再生成する。

出力列: id, 日付(YYYY/MM/DD), タイトル, タグ(「・」区切り), URL
タグは記事ページの短いラベルだけを使う。本文は保存しない（再配布を避けるため。
本文は fetch_article.py で都度取得する）。
標準ライブラリのみ使用。所要時間は記事数に比例する（約370件で数分）。
"""
import html
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = "https://www.ryuzee.com/contents/blog/"
OUT = Path(__file__).resolve().parent.parent / "references" / "index.tsv"
CARD = re.compile(
    r'<div class="text-secondary small mb-2">([\d/]+)</div>'
    r'<div class="fw-semibold mb-2"><a href="/contents/blog/(\d+)"[^>]*>(.*?)</a>',
    re.S,
)
TAG_BLOCK = re.compile(r'class="tagcloud clearfix entry-meta-tags">(.*?)</div>', re.S)
TAG = re.compile(r'<a href="/tags/[^"]*">([^<]+)</a>')
YEAR = re.compile(r"^\d{4}$")
DELAY = 0.5  # サーバ負荷への配慮


def fetch(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "ryuzee-agile-advisor/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""


def list_entries() -> dict[str, tuple[str, str]]:
    rows: dict[str, tuple[str, str]] = {}
    page = 1
    while True:
        url = BASE if page == 1 else f"{BASE}page/{page}/"
        status, body = fetch(url)
        if status != 200:
            break
        found = CARD.findall(body)
        if not found:
            break
        for date, aid, title in found:
            title = html.unescape(re.sub(r"<[^>]+>", "", title)).strip()
            rows.setdefault(aid, (date, title))
        print(f"page {page}: {len(found)} cards", file=sys.stderr)
        page += 1
        time.sleep(DELAY)
    return rows


def tags_of(aid: str) -> str:
    status, body = fetch(f"{BASE}{aid}")
    if status != 200:
        return ""
    block = TAG_BLOCK.search(body)
    if not block:
        return ""
    tags = [html.unescape(t).strip() for t in TAG.findall(block.group(1))]
    tags = [t for t in tags if t and not YEAR.match(t)]
    return "・".join(dict.fromkeys(tags))  # 重複を除き、出現順を保つ


def main() -> int:
    rows = list_entries()
    if not rows:
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        f.write("id\tdate\ttitle\ttags\turl\n")
        for i, aid in enumerate(sorted(rows, key=int, reverse=True), 1):
            date, title = rows[aid]
            tags = tags_of(aid)
            time.sleep(DELAY)
            f.write(f"{aid}\t{date}\t{title}\t{tags}\thttps://www.ryuzee.com/contents/blog/{aid}\n")
            if i % 50 == 0:
                print(f"tags: {i}/{len(rows)}", file=sys.stderr)
    print(f"wrote {len(rows)} entries to {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
