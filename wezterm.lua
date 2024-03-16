local wezterm = require 'wezterm'

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

-- カラースキームの設定
config.color_scheme = 'iceberg-dark'

-- フォントの設定
config.font = wezterm.font 'HackGen35 Console NF'

-- フォントサイズの設定
config.font_size = 16

return config
