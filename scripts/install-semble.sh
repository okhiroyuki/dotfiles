#!/bin/bash

set -e

if ! command -v uv >/dev/null 2>&1; then
    echo "uv not found (mise管理下のuvが有効になっているか確認してください)" >&2
    exit 1
fi

# バージョンは dotfiles にピン留めし、renovate が pypi datasource で自動更新する。
# CLI と MCP サーバーは同じ版を使う。pin を上げた反映はこのスクリプトの再実行
# (MCP 登録の remove+add)まで自動で行われる。
uv tool install "semble==0.7.3"

# semble 用の bekko モデル(正規化を有効にしたもの)を作る。zshenv はこれがあれば
# SEMBLE_MODEL_NAME に使う。理由は build-semble-model.py の冒頭を参照。作成済みなら何もしない。
# model2vec の版を semble に揃えるため、semble と同じ pin の環境で実行する。
bekko_normalized="$HOME/.local/share/semble/models/bekko-static-embedding-v1-normalized"
uv run --no-project --with "semble==0.7.3" python "${BASH_SOURCE[0]%/*}/build-semble-model.py" \
    "$bekko_normalized"

# MCP サーバーは Claude Code が zsh を通さずに起動するため、zshenv の SEMBLE_MODEL_NAME が
# 届かず semble の既定モデル(日本語に弱い)で動く。登録時に同じ値を env として渡す。
# 値の決め方は zshenv と揃える(正規化版があればそのパス、なければ HF のモデル名)。
if [[ -f "$bekko_normalized/config.json" ]]; then
    semble_model="$bekko_normalized"
else
    semble_model="hotchpotch/bekko-static-embedding-v1"
fi

# Claude Code の user スコープに semble MCP サーバーを登録する。
# 登録先の ~/.claude.json は Claude Code が自分で書き換えるファイルで dotfiles 管理外のため、
# 設定はここでコード化し、新マシンでは install:semble タスクの再実行で登録し直す。
# 既存登録があっても remove してから登録し直す(user スコープを明示)。pin の変更も
# 再実行で実体に届く。claude mcp add は既存登録があると失敗するためスキップ判定はしない。
if ! command -v claude >/dev/null 2>&1; then
    echo "claude not found (Claude CodeへのMCP登録をスキップしました)" >&2
else
    claude mcp remove semble -s user >/dev/null 2>&1 || true
    # -e は可変長引数なので、-- で区切ってから起動コマンドを書く。
    claude mcp add semble -s user -e "SEMBLE_MODEL_NAME=$semble_model" -- uvx --from "semble[mcp]==0.7.3" semble
fi
