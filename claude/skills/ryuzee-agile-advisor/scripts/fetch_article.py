#!/usr/bin/env python3
"""記事 ID を指定して本文のプレーンテキストを標準出力に出す。

使い方: fetch_article.py 14622 [14611 ...]
本文は保存しない。必要な記事だけ都度取得する。
標準ライブラリのみ使用。
"""
import html
import re
import sys
import urllib.request

URL = "https://www.ryuzee.com/contents/blog/{}"
BODY = re.compile(r'<div class="entry-content[^"]*">(.*?)</div>\s*(?:<div class="(?:si-share|post-navigation|entry-meta-tags|clear)|</div>\s*</div>)', re.S)


def to_text(fragment: str) -> str:
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", fragment, flags=re.S)
    s = re.sub(r"<br\s*/?>|</p>|</li>|</h[1-6]>|</div>", "\n", s)
    s = re.sub(r"<li[^>]*>", "- ", s)
    s = re.sub(r"<h[1-6][^>]*>", "\n## ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    lines = [ln.strip() for ln in s.splitlines()]
    out, blank = [], False
    for ln in lines:
        if not ln:
            if not blank and out:
                out.append("")
            blank = True
        else:
            out.append(ln)
            blank = False
    return "\n".join(out).strip()


def fetch(aid: str) -> str:
    req = urllib.request.Request(URL.format(aid), headers={"User-Agent": "ryuzee-agile-advisor/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        page = r.read().decode("utf-8", "replace")
    title = re.search(r'<div class="entry-title"><h1[^>]*>(.*?)</h1>', page, re.S)
    date = re.search(r'<i class="icon-calendar3"></i>\s*([\d/]+)', page)
    body = BODY.search(page)
    if not body:
        raise RuntimeError(f"本文が見つからない: {aid}")
    head = f"# {html.unescape(title.group(1)) if title else aid}\n日付: {date.group(1) if date else '不明'}\nURL: {URL.format(aid)}\n\n"
    return head + to_text(body.group(1))


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    for aid in argv:
        print(fetch(aid))
        print("\n---\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
