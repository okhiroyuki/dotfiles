# load anyenv if available
export PATH="$HOME/.anyenv/bin:$PATH"

if which anyenv &>/dev/null; then
   if ! [ -f /tmp/anyenv.cache ]
   then
      anyenv init - --no-rehash > /tmp/anyenv.cache
      zcompile /tmp/anyenv.cache
   fi
   source /tmp/anyenv.cache

   if ! [ -f /tmp/nodeenv.cache ]
   then
      nodenv init - > /tmp/nodeenv.cache
      zcompile /tmp/nodeenv.cache
   fi
   source /tmp/nodeenv.cache
fi
