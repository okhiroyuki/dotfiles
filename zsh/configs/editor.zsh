if builtin command -v zed > /dev/null; then
  export VISUAL='zed --wait'
else
  export VISUAL=vim
fi
export EDITOR=$VISUAL
