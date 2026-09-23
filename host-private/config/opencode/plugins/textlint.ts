// V2 plugin: runs textlint on .md/.txt files right after the agent edits them.

import fs from "node:fs"
import fsAsync from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Plugin } from "@opencode/plugin"
import { spawnText, which } from "./lib/spawn.ts"

const LINTABLE = /\.(md|txt)$/i
const TEXTLINT_DIR = path.join(process.env.HOME ?? "", "dotfiles", "tools", "textlint")
const TEXTLINT_BIN = path.join(TEXTLINT_DIR, "node_modules", ".bin", "textlint")
const TEXTLINT_JS = path.join(TEXTLINT_DIR, "node_modules", "textlint", "bin", "textlint.js")
const TEXTLINT_CONFIG = path.join(TEXTLINT_DIR, ".textlintrc.json")
const EDIT_TOOLS = new Set(["write", "edit", "apply_patch"])
const DEBUG_LOG = path.join(os.tmpdir(), "textlint-plugin-debug.log")

type ToolResult = {
  title?: unknown
  content?: unknown
  output?: unknown
  metadata?: unknown
}

type ToolEvent = {
  tool: unknown
  status: unknown
  input?: unknown
  result?: unknown
  error?: { message?: unknown }
}

// ツールの入出力はハーネスによって引数名・形状が異なる(filePath/path/file)。
// あり得るキーを再帰的に見て .md/.txt に解決できる値だけ拾う。
const PATH_KEYS = ["filePath", "path", "file", "filepath", "relativePath", "fullPath"]

function toAbsolute(value: unknown, directory: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const abs = path.isAbsolute(value) ? value : path.resolve(directory, value)
  return LINTABLE.test(abs) && fs.existsSync(abs) ? abs : null
}

function collectFiles(input: unknown, result: unknown, directory: string): string[] {
  const found = new Set<string>()

  const scan = (value: unknown) => {
    if (!value) return
    if (typeof value === "string") {
      const abs = toAbsolute(value, directory)
      if (abs) found.add(abs)
      return
    }
    if (typeof value !== "object") return
    const record = value as Record<string, unknown>
    for (const key of PATH_KEYS) scan(record[key])
    if (Array.isArray(record.files)) {
      for (const file of record.files) scan(file)
    }
  }

  scan(input)
  if (input && typeof input === "object") scan((input as Record<string, unknown>).args)
  scan(result)
  if (result && typeof result === "object") scan((result as Record<string, unknown>).metadata)

  // title が "Created file successfully: <path>" のような形式のとき、末尾のパスらしき
  // トークンを拾う。実在チェックは toAbsolute 側で行うので空振りは無害。
  const title = result && typeof result === "object" ? (result as Record<string, unknown>).title : null
  if (typeof title === "string" && title.trim() && !title.includes("\n")) {
    for (const token of title.match(/(?:[^\s:]+\/)?[^\s:]+\.(?:md|txt)/gi) ?? []) {
      const abs = toAbsolute(token, directory)
      if (abs) found.add(abs)
    }
  }

  return [...found]
}

async function debugLog(line: string): Promise<void> {
  try {
    const stat = await fsAsync.stat(DEBUG_LOG).catch(() => null)
    if (stat && stat.size > 200_000) return
    await fsAsync.appendFile(DEBUG_LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // デバッグログは本筋ではないので失敗は握り潰す
  }
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
      const toolEvent = event as ToolEvent
      if (toolEvent.status !== "completed") return
      if (!EDIT_TOOLS.has(String(toolEvent.tool))) return

      const files = collectFiles(toolEvent.input, toolEvent.result, directory)
      void debugLog(`collect tool=${JSON.stringify(String(toolEvent.tool))} files=${JSON.stringify(files)}`)
      if (files.length === 0) return

      const reports: string[] = []
      for (const file of files) {
        const res = await spawnText([...command, "--config", TEXTLINT_CONFIG, "--format", "stylish", file], {
          cwd: TEXTLINT_DIR,
        })
        if (res.stdout.trim()) reports.push(res.stdout.trim())
      }
      if (reports.length === 0) return

      const result = toolEvent.result as { content?: unknown; output?: unknown } | undefined
      const extra = `\n\n# textlint\n${reports.join("\n")}`
      if (typeof result?.content === "string") {
        toolEvent.result = { ...result, content: result.content + extra }
      } else if (typeof result?.output === "string") {
        toolEvent.result = { ...result, output: result.output + extra }
      } else {
        toolEvent.result = result ? { ...result, content: extra } : extra
      }
    })
  },
})
