if command -v starship >/dev/null 2>&1 ; then
    export STARSHIP_CONFIG=~/.starship/config.toml
    # キャッシュはユーザー専有ディレクトリに置く。固定名で共有の /tmp に置くと、
    # 他ユーザーが先に同名ファイルを仕込めば source 経由でコード実行され得る。
    _starship_cache="${XDG_CACHE_HOME:-$HOME/.cache}/starship/init.zsh"
    # starship 本体がキャッシュより新しい（アップグレード後など）場合は作り直す。
    if [ ! -f "$_starship_cache" ] || [ "$(command -v starship)" -nt "$_starship_cache" ]; then
        mkdir -p "$(dirname "$_starship_cache")"
        starship init zsh > "$_starship_cache"
        zcompile "$_starship_cache"
    fi
    source "$_starship_cache"
    unset _starship_cache
fi
