# claude/ 設定レイアウトの設計判断

`.claude/rules/claude-config-scope.md` に書いてある制約の「なぜ」をここに置く。
制約だけは rule として毎セッション読まれるが、この根拠は必要になったときに読めばよいため分けている。
判断を変えるとき・レイアウトを触るときはここを先に読む。

## グローバルルールの集約点を claude/CLAUDE.md 一つに固定する理由

`~/.claude/CLAUDE.md` の実体は `claude/CLAUDE.md` だけにしてある。
全マシンで同一のファイルが読まれ、`-B private` でも `-B work` でも変わらない。

集約点を host 側に置くと、その host の CLAUDE.md を用意し忘れたマシンでルールが一切ロードされない事故が起きる。
**暗黙の欠落**を避けるため、集約点は共有の `claude/` に固定する。

## settings.json はあえて host-private に置く理由

`claude/CLAUDE.md` とは逆に、`settings.json` は共有の `claude/` へは置かず `host-private/claude/settings.json` に留めている。

CLAUDE.md を共有に集約したのは上記の暗黙の欠落を避けるためだったが、settings.json では防ぎたい事故の向きが逆になる。
新しいマシンで `host-<name>/claude/settings.json` を作らなければ `~/.claude/settings.json` は存在しない状態から始まり、
そのマシンにとって未検討の許可・プラグイン構成を**暗黙に継承しない**。

これは意図した振る舞いである。settings.json を新しいホストで用意するときは、既存ホストの内容をそのまま複製せず、
そのマシンに必要な許可だけを吟味して書く。

## host-work を claude ルールに使わない理由

マシン間のルールの差分は「共通ルール + 会社ルール」という追加のみで、共通ルールを減らす方向の差分は想定しない。
追加は `local/claude/rules/local.md` の有無だけで表現できるため、host ごとに別の集約点を作る必要がない。

`host-work/` を作るのは、work用の `gitconfig` や `Brewfile` などマシン固有の非claude設定が必要になったときに限る。
現時点で `host-work/` は存在しない。

## 空スタブ（claude/rules/local.md）を最小限に保つ理由

`claude/CLAUDE.md` は末尾で `@rules/local.md` を import する。
共有側の `claude/rules/local.md` は空スタブで、import を常に解決させるためだけに置いてある。
会社ルールが必要なマシンでは `local/claude/rules/local.md` を置き、`local` 優先によりスタブを上書きさせる。

このスタブは全セッションの ambient に載る。
説明を書き込むと、全プロジェクト・全セッションでその分を払い続けることになるため、本文は1行に留める。
存在理由の正本はこのファイルと `claude-config-scope.md` である。

`local/` 側の運用メモは `local/README.md`（gitignore対象）にある。
