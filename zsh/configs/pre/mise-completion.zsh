# compinit（sheldonのcompinitプラグイン）より前にfpathへ登録する必要があるため
# pre/ に置く。mise自体はaliases未使用のためmise.zshでのactivateとは分離している。
if command -v mise >/dev/null 2>&1; then
  _mise_completion_dir="$HOME/.zsh/completions"
  _mise_completion_file="$_mise_completion_dir/_mise"
  _mise_bin="$(command -v mise)"

  if [[ ! -f "$_mise_completion_file" ]] || [[ "$_mise_bin" -nt "$_mise_completion_file" ]]; then
    mkdir -p "$_mise_completion_dir"
    mise completion zsh > "$_mise_completion_file"
  fi

  fpath=("$_mise_completion_dir" $fpath)
  unset _mise_completion_dir _mise_completion_file _mise_bin
fi
