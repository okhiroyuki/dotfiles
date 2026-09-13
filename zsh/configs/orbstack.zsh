# OrbStack installs its docker/kubectl/orbctl CLI shims under ~/.orbstack/bin,
# which is not in the default PATH. Prefix it when OrbStack is installed.
if [ -d "$HOME/.orbstack/bin" ]; then
  export PATH="$HOME/.orbstack/bin:$PATH"
fi
