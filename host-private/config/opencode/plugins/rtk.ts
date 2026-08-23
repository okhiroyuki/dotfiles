import type { Plugin } from "@opencode-ai/plugin"

const TARGETS = [/^(?:ls|rg)\b/, /^git (?:diff|log|status|show|blame)\b/]
const UNSAFE = /[;&|<>`$()\n]/

export const RtkPlugin: Plugin = async () => {
  if (process.env.RTK_PLUGIN_DISABLE) return {}
  const bin = Bun.which("rtk")
  if (!bin) return {}
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return
      const command = output.args?.command
      if (typeof command !== "string") return
      const trimmed = command.trim()
      if (!trimmed || UNSAFE.test(trimmed) || !TARGETS.some((pattern) => pattern.test(trimmed))) return
      output.args.command = `${bin} ${trimmed}`
    },
  }
}
