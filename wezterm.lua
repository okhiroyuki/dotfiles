local wezterm = require 'wezterm'

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

config.color_scheme = 'iceberg-dark'
config.font = wezterm.font 'HackGen35 Console NF'
config.font_size = 16
config.hide_tab_bar_if_only_one_tab = true
config.adjust_window_size_when_changing_font_size = false

return config
