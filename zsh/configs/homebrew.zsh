# To opt in to Homebrew analytics, `unset` this in ~/.zshrc.local .
# Learn more about what you are opting in to at
# https://docs.brew.sh/Analytics
export HOMEBREW_NO_ANALYTICS=1
export HOMEBREW_NO_ENV_HINTS=1

# Shared by zshenv and zprofile. Apple Silicon Homebrew isn't part of
# macOS's default PATH (only /usr/local/bin, the Intel prefix, ships in
# /etc/paths), so brew itself and everything installed through it would
# otherwise be unresolvable in a fresh shell.
#
# - zshenv: runs for every zsh invocation, including non-interactive
#   shells (scripts, tool subprocesses).
# - zprofile: macOS runs /etc/zprofile's path_helper for login shells,
#   which prepends /usr/bin and friends *after* zshenv already ran, so
#   this needs to be re-applied here too.
#
# Strip any existing occurrence first (launchd/path_helper can leave
# /opt/homebrew/bin behind /usr/bin via /etc/paths.d/homebrew) so
# Homebrew binaries are guaranteed to precede system ones.
if [ -d /opt/homebrew/bin ]; then
  export PATH="$(printf '%s\n' "$PATH" | tr ':' '\n' | grep -vxE '/opt/homebrew/(bin|sbin)' | paste -sd: -)"
  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
fi
