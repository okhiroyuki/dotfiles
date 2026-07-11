# CLAUDE.md

## push 前のルール

コミットを push する前に、必ずローカルで pre-commit を実行して確認すること。

```zsh
pre-commit run --files <変更したファイル...>
```

現状、システムの `python3` が古く（3.9.6、yamllint の要求する `>=3.10` を満たさない）、
`yamllint` フックの環境構築が失敗する。YAML を変更していない場合は `SKIP=yamllint` で
迂回してよいが、YAML ファイルを変更した場合は迂回せず、`python3` を新しくしてから確認する。

```zsh
SKIP=yamllint pre-commit run --files <変更したファイル...>
```

## crit の起動

「レビューして」など、レビューを依頼する言葉を受けたときは、汎用の `code-review` ではなく
`crit:crit` skill を起動すること（"crit" という単語が含まれていなくてもよい）。

その際、作業ツリーの未コミット diff だけでなく、コミット済みの変更も含めてレビュー対象にすること
（引数なしの `crit`＝ブランチ diff モードを使う）。
