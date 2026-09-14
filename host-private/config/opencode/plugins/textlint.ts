import fs from "node:fs"
import path from "node:path"
import { type Plugin } from "@opencode-ai/plugin"
import { spawnText, which } from "./lib/spawn.ts"

const LINTABLE = /\.(md|txt)$/i
const TEXTLINT_DIR = path.join(process.env.HOME ?? "", "dotfiles", "tools", "textlint")
const TEXTLINT_BIN = path.join(TEXTLINT_DIR, "node_modules", ".bin", "textlint")
const TEXTLINT_JS = path.join(TEXTLINT_DIR, "node_modules", "textlint", "bin", "textlint.js")
const TEXTLINT_CONFIG = path.join(TEXTLINT_DIR, ".textlintrc.json")
const EDIT_TOOLS = new Set(["write", "edit", "apply_patch"])

type PatchFile = { filePath?: unknown; relativePath?: unknown }
type ToolOutput = {
  title?: unknown
  metadata?: { files?: PatchFile[]; filepath?: unknown; filePath?: unknown }
}
type ToolInput = { args?: { filePath?: unknown } }

function toAbsolute(value: unknown, directory: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const abs = path.isAbsolute(value) ? value : path.resolve(directory, value)
  return LINTABLE.test(abs) ? abs : null
}

function collectFiles(input: ToolInput, output: ToolOutput, directory: string): string[] {
  const found = new Set<string>()
  const push = (value: unknown) => {
    const abs = toAbsolute(value, directory)
    if (abs) found.add(abs)
  }

  for (const file of output.metadata?.files ?? []) {
    push(file.filePath ?? file.relativePath)
  }
  push(output.metadata?.filepath)
  push(output.metadata?.filePath)
  push(input.args?.filePath)

  const title = typeof output.title === "string" ? output.title.trim() : ""
  if (title && !title.includes("\n")) push(title)

  return [...found]
}

export const TextlintPlugin: Plugin = async ({ directory }) => {
  if (process.env.TEXTLINT_AI_WORDS_SKIP === "1") return {}
  if (!fs.existsSync(TEXTLINT_CONFIG)) return {}
  if (!fs.existsSync(TEXTLINT_JS) && !fs.existsSync(TEXTLINT_BIN)) return {}

  const node = which("node")
  const command = node ? [node, TEXTLINT_JS] : [TEXTLINT_BIN]

  return {
    "tool.execute.after": async (input, output) => {
      if (!EDIT_TOOLS.has(input.tool)) return

      const files = collectFiles(input, output, directory)
      if (files.length === 0) return

      const reports: string[] = []
      for (const file of files) {
        const res = await spawnText([...command, "--config", TEXTLINT_CONFIG, "--format", "stylish", file], {
          cwd: TEXTLINT_DIR,
        })
        if (res.stdout.trim()) reports.push(res.stdout.trim())
      }
      if (reports.length === 0) return

      output.output = `${output.output}\n\n# textlint\n${reports.join("\n")}`
    },
  }
}
