#!/bin/bash

# install-semble.sh の分岐をスタブで検証する。
# 実物の uv/claude・ネットワーク・~/.claude.json には触れない(PATH をスタブディレクトリに差し替える)。
# 検証する分岐:
#   1. uv 不在 → スクリプトが失敗する
#   2. claude 不在 → MCP 登録をスキップして成功する
#   3. remove 失敗(未登録相当)→ 無視して期待する引数で add する。モデル名は
#      正規化版がなければ HF のモデル名、あればそのパスを env で渡す
#   4. add 失敗 → スクリプトも失敗する
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_SCRIPT="$SCRIPT_DIR/install-semble.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# スタブの呼び出しログ。コマンド置換のサブシェルからも参照できるよう事前に export する。
STUB_LOG="$TMP/stub.log"
export STUB_LOG

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

expect_log() {
    grep -F -- "$2" "$STUB_LOG" >/dev/null || fail "$1: ログに「$2」がない"
}

# uv(成功する no-op)と claude(mcp remove/add の終了コードを STUB_*_EXIT で制御)のスタブ。
# 両スタブとも呼び出し引数を STUB_LOG に残す。
mkdir -p "$TMP/empty" "$TMP/uv-only" "$TMP/uv-claude"

# shellcheck disable=SC2016  # スタブ内で展開されないことを意図している
printf '#!/bin/bash\nprintf "%%s\\n" "uv $*" >> "$STUB_LOG"\n' > "$TMP/uv-only/uv"
cp "$TMP/uv-only/uv" "$TMP/uv-claude/uv"

cat > "$TMP/uv-claude/claude" <<'STUB'
#!/bin/bash
printf '%s\n' "claude $*" >> "$STUB_LOG"
case "$2" in
    remove) exit "${STUB_REMOVE_EXIT:-0}" ;;
    add) exit "${STUB_ADD_EXIT:-0}" ;;
esac
exit 0
STUB

chmod +x "$TMP/uv-only/uv" "$TMP/uv-claude/uv" "$TMP/uv-claude/claude"

# HOME も一時ディレクトリに差し替え、実マシンのモデル有無に結果が左右されないようにする。
FAKE_HOME="$TMP/home"
NORMALIZED="$FAKE_HOME/.local/share/semble/models/bekko-static-embedding-v1-normalized"
mkdir -p "$FAKE_HOME"

run_install() {
    # $1: "no-claude" なら claude を PATH から外して実行する
    : > "$STUB_LOG"
    if [ "${1:-}" = "no-claude" ]; then
        HOME="$FAKE_HOME" PATH="$TMP/uv-only" "$INSTALL_SCRIPT"
    else
        STUB_REMOVE_EXIT="${STUB_REMOVE_EXIT:-0}" STUB_ADD_EXIT="${STUB_ADD_EXIT:-0}" \
            HOME="$FAKE_HOME" PATH="$TMP/uv-claude" "$INSTALL_SCRIPT"
    fi
}

# 1. uv 不在
out=$(PATH="$TMP/empty" "$INSTALL_SCRIPT" 2>&1)
rc=$?
[ "$rc" -eq 1 ] || fail "uv不在: 終了コードが1ではない ($rc)"
case "$out" in
    *"uv not found"*) ;;
    *) fail "uv不在: 期待するメッセージが出ない: $out" ;;
esac

# 2. claude 不在 → 登録をスキップして成功
out=$(run_install no-claude 2>&1)
rc=$?
[ "$rc" -eq 0 ] || fail "claude不在: 終了コードが0ではない ($rc)"
expect_log "claude不在" "uv tool install semble==0.7.3"
expect_log "claude不在" "uv run --no-project --with semble==0.7.3 python $SCRIPT_DIR/build-semble-model.py"
if grep -q "claude mcp add" "$STUB_LOG"; then
    fail "claude不在: add が呼ばれた"
fi

# 3. remove 失敗を無視して add が期待する引数で呼ばれる(正規化版モデルがない → HF のモデル名を渡す)
out=$(STUB_REMOVE_EXIT=1 run_install 2>&1)
rc=$?
[ "$rc" -eq 0 ] || fail "remove失敗無視: 終了コードが0ではない ($rc)"
expect_log "remove失敗無視" "claude mcp remove semble -s user"
expect_log "remove失敗無視" "claude mcp add semble -s user -e SEMBLE_MODEL_NAME=hotchpotch/bekko-static-embedding-v1 -- uvx --from semble[mcp]==0.7.3 semble"

# 3b. 正規化版モデルがある → そのパスを MCP に渡す
mkdir -p "$NORMALIZED"
: > "$NORMALIZED/config.json"
out=$(run_install 2>&1)
rc=$?
[ "$rc" -eq 0 ] || fail "正規化版あり: 終了コードが0ではない ($rc)"
expect_log "正規化版あり" "claude mcp add semble -s user -e SEMBLE_MODEL_NAME=$NORMALIZED -- uvx --from semble[mcp]==0.7.3 semble"
rm -rf "$NORMALIZED"

# 4. add 失敗 → スクリプトも失敗
out=$(STUB_ADD_EXIT=1 run_install 2>&1)
rc=$?
[ "$rc" -ne 0 ] || fail "add失敗: スクリプトが失敗しない"
expect_log "add失敗" "claude mcp add semble -s user"

echo "ok: install-semble.sh の分岐テスト"
