local wezterm = require 'wezterm'

local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

config.color_scheme = 'iceberg-dark'
config.font = wezterm.font_with_fallback {
  'HackGen35 Console NF',
  'Menlo Regular'
}
config.font_size = 14
config.hide_tab_bar_if_only_one_tab = true
config.adjust_window_size_when_changing_font_size = false
config.send_composed_key_when_left_alt_is_pressed = true
config.enable_scroll_bar = true
config.scrollback_lines = 3500
config.initial_rows = 30
config.initial_cols = 120
config.line_height = 0.9
config.cell_width = 0.9
return config
