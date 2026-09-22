// V2 plugin: runs textlint on .md/.txt files right after the agent edits them.

import fs from "node:fs"
import path from "node:path"
import { Plugin } from "@opencode/plugin"
import { spawnText, which } from "./lib/spawn.ts"

const LINTABLE = /\.(md|txt)$/i
const TEXTLINT_DIR = path.join(process.env.HOME ?? "", "dotfiles", "tools", "textlint")
const TEXTLINT_BIN = path.join(TEXTLINT_DIR, "node_modules", ".bin", "textlint")
const TEXTLINT_JS = path.join(TEXTLINT_DIR, "node_modules", "textlint", "bin", "textlint.js")
const TEXTLINT_CONFIG = path.join(TEXTLINT_DIR, ".textlintrc.json")
const EDIT_TOOLS = new Set(["write", "edit", "apply_patch"])

type PatchFile = { filePath?: unknown; relativePath?: unknown }
type ToolResult = {
  title?: unknown
  content?: string
  output?: string
  metadata?: { files?: PatchFile[]; filepath?: unknown; filePath?: unknown }
}
type ToolInput = { args?: { filePath?: unknown } }

function toAbsolute(value: unknown, directory: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const abs = path.isAbsolute(value) ? value : path.resolve(directory, value)
  return LINTABLE.test(abs) ? abs : null
}

function collectFiles(input: ToolInput, result: ToolResult, directory: string): string[] {
  const found = new Set<string>()
  const push = (value: unknown) => {
    const abs = toAbsolute(value, directory)
    if (abs) found.add(abs)
  }

  for (const file of result.metadata?.files ?? []) {
    push(file.filePath ?? file.relativePath)
  }
  push(result.metadata?.filepath)
  push(result.metadata?.filePath)
  push(input.args?.filePath)

  const title = typeof result.title === "string" ? result.title.trim() : ""
  if (title && !title.includes("\n")) push(title)

  return [...found]
}

export default Plugin.define({
  id: "textlint",
  async setup(ctx) {
    if (process.env.TEXTLINT_AI_WORDS_SKIP === "1") return
    if (!fs.existsSync(TEXTLINT_CONFIG)) return

    const hasJs = fs.existsSync(TEXTLINT_JS)
    const hasBin = fs.existsSync(TEXTLINT_BIN)
    if (!hasJs && !hasBin) return

    // Prefer the JS entry when node is available, else the bin shim, else bail.
    const node = hasJs ? which("node") : null
    let command: string[]
    if (hasJs && node) {
      command = [node, TEXTLINT_JS]
    } else if (hasBin) {
      command = [TEXTLINT_BIN]
    } else {
      return
    }
    const directory = ctx.location.directory

    await ctx.tool.hook("execute.after", async (event) => {
      if (event.status !== "completed") return
      if (!EDIT_TOOLS.has(event.tool)) return

      const input = (event.input ?? {}) as ToolInput
      const result = (event.result ?? {}) as ToolResult
      const files = collectFiles(input, result, directory)
      if (files.length === 0) return

      const reports: string[] = []
      for (const file of files) {
        const res = await spawnText([...command, "--config", TEXTLINT_CONFIG, "--format", "stylish", file], {
          cwd: TEXTLINT_DIR,
        })
        if (res.stdout.trim()) reports.push(res.stdout.trim())
      }
      if (reports.length === 0) return

      const extra = `\n\n# textlint\n${reports.join("\n")}`
      if (typeof result.content === "string") {
        event.result = { ...result, content: result.content + extra }
      } else if (typeof result.output === "string") {
        event.result = { ...result, output: result.output + extra }
      } else {
        event.result = { ...result, content: extra }
      }
    })
  },
})
