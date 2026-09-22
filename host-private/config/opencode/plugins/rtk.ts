// V2 plugin: rewrites read-only ls/rg/git commands through the rtk CLI.

import { Plugin } from "@opencode/plugin"
import { which } from "./lib/spawn.ts"

const TARGETS = [/^(?:ls|rg)\b/, /^git (?:diff|log|status|show|blame)\b/]
const UNSAFE = /[;&|<>`$()\n]/

export default Plugin.define({
  id: "rtk",
  async setup(ctx) {
    if (process.env.RTK_PLUGIN_DISABLE) return
    const bin = which("rtk")
    if (!bin) return
    // Quote the resolved path for shell use; extra dirs may contain spaces.
    const prefix = /[^\w@%+=:,./-]/.test(bin) ? `'${bin.replaceAll("'", `'\\''`)}'` : bin

    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool !== "bash") return
      const input = event.input as { command?: unknown } | undefined
      const command = input?.command
      if (typeof command !== "string") return
      const trimmed = command.trim()
      if (!trimmed || UNSAFE.test(trimmed) || !TARGETS.some((pattern) => pattern.test(trimmed))) return
      input.command = `${prefix} ${trimmed}`
    })
  },
})
