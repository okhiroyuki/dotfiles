---
description: Web取得は必ずaxスキル経由、だめな場合のみWebFetchにフォールバック
---

## Web アクセス

- URLの取得・未知のWebページの探索・HTMLからの構造化データ抽出を行う場合は、**必ず`ax`スキルを使う**。素の`curl`や`WebFetch`をいきなり使わない
- `ax`で取得できない場合（JSレンダリングのSPAで`ax`自身が「browser toolに切り替えろ」と示す場合など）に限り、`WebFetch`にフォールバックする
