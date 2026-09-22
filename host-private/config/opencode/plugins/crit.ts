// crit plugin for opencode.
//
// 1. Injects crit's "Sharing" instructions into the model's system prompt only
//    when the user has opted into sharing by setting `share_url` in their crit
//    config. Without this gate, the sharing block is dead weight when sharing
//    is disabled and can trip enterprise information-handling reviews.
// 2. Toasts when the agent starts a blocking `crit` wait so Attention-style
//    users notice a review is ready even while the tool call is still running.
//
// Notes captured during implementation (V2 plugin API):
//   - opencode auto-loads .ts files dropped into `.opencode/plugins/` (project)
//     or `~/.config/opencode/plugins/` (global). No registration in
//     opencode.jsonc is required for local files.
//   - The V1 `experimental.chat.system.transform` hook maps to
//     `ctx.session.hook("context", ...)`, which appends SystemPart entries to
//     the mutable `event.system` array. V2 runs "context" only for the agent
//     loop — title generation has its own hook — so the old title-generator
//     skip check is no longer needed.
//   - Crit config is read by shelling out to `crit config`, which prints a
//     JSON object. We parse `share_url` and bail out if empty. This runs once
//     in setup (transforms/hooks must not do one-time side effects), and the
//     sharing hook is only registered when sharing is enabled.

import { createRequire } from "node:module"
import { Plugin } from "@opencode/plugin"
import { spawnText } from "./lib/spawn.ts"

const require = createRequire(import.meta.url)
const { isCritWaitCommand, roundReadyToast } = require("./lib/crit-wait-notify.js") as {
  isCritWaitCommand: (command: string) => boolean
  roundReadyToast: (url?: string) => { title: string; message: string }
}

const SHARING_BLOCK = `## Sharing

If the user asks for a URL, a shareable link, or a QR code for the review:

\`\`\`bash
crit share <file> [file...]   # Upload and print URL
crit share --qr <file>        # Also print QR code (terminal only)
crit unpublish [file...]                              # Remove shared review
\`\`\`

- **Always relay the output** — copy the URL (and QR if used) into your response. Don't make the user dig through tool output.
- **\`--qr\` is terminal-only** — skip in mobile apps, web chat UIs, or anywhere Unicode block characters won't render correctly.
- **Unpublish uses the persisted delete token** in the review file — no extra args needed.
`

type CritConfig = { share_url?: string }

type TuiLike = { showToast?: (input: unknown) => Promise<unknown> | unknown }
type LogLike = { log?: (input: unknown) => Promise<unknown> | unknown }

async function loadShareURL(): Promise<string | null> {
  try {
    const res = await spawnText(["crit", "config"])
    if (res.code !== 0) return null
    const parsed = JSON.parse(res.stdout) as CritConfig
    return parsed.share_url && parsed.share_url.length > 0 ? parsed.share_url : null
  } catch {
    return null
  }
}

async function showToast(ctx: unknown, title: string, message: string): Promise<void> {
  // Toast delivery is best-effort: the tui domain is undocumented in the V2
  // plugin context, so try both payload shapes, then fall back to app.log.
  const tui = (ctx as { tui?: TuiLike }).tui
  if (typeof tui?.showToast === "function") {
    const payloads = [{ body: { title, message, variant: "info" } }, { title, message, variant: "info" }]
    for (const payload of payloads) {
      try {
        await tui.showToast(payload)
        return
      } catch {
        // Try the next payload shape.
      }
    }
  }
  try {
    const app = (ctx as { app?: LogLike }).app
    if (typeof app?.log === "function") {
      await app.log({ body: { service: "crit", level: "info", message: `[Crit] ${message}` } })
    }
  } catch {
    // Logging is best-effort.
  }
}

function bashCommandFromEvent(input: unknown): string {
  const args = (input as { args?: { command?: unknown; cmd?: unknown } } | undefined)?.args
  if (typeof args?.command === "string") return args.command
  if (typeof args?.cmd === "string") return args.cmd
  const direct = (input as { command?: unknown; cmd?: unknown } | undefined)
  if (typeof direct?.command === "string") return direct.command
  if (typeof direct?.cmd === "string") return direct.cmd
  return ""
}

export default Plugin.define({
  id: "crit",
  async setup(ctx) {
    const shareURL = await loadShareURL()

    if (shareURL) {
      await ctx.session.hook("context", (event) => {
        event.system.push({ type: "text", text: SHARING_BLOCK })
      })
    }

    await ctx.tool.hook("execute.before", (event) => {
      const tool = String(event.tool ?? "").toLowerCase()
      if (tool !== "bash" && tool !== "shell") return
      const command = bashCommandFromEvent(event.input)
      if (!isCritWaitCommand(command)) return
      const toast = roundReadyToast(shareURL ?? undefined)
      void showToast(ctx, toast.title, toast.message)
    })
  },
})
