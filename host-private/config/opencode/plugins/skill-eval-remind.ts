// V2 plugin: appends a skill-eval reminder to tool output when a SKILL.md is edited.

import fs from "node:fs"
import path from "node:path"
import { Plugin } from "@opencode/plugin"

const EDIT_TOOLS = new Set(["write", "edit", "apply_patch"])
const KILL_SWITCH = "SKILL_EVAL_REMIND_DISABLE"

type PatchFile = { filePath?: unknown; relativePath?: unknown }
type ToolResult = {
  title?: unknown
  content?: string
  output?: string
  metadata?: { files?: PatchFile[]; filepath?: unknown; filePath?: unknown }
}
type ToolInput = { args?: { filePath?: unknown } }

function toSkillMdPath(value: unknown, directory: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const abs = path.isAbsolute(value) ? value : path.resolve(directory, value)
  if (path.basename(abs) !== "SKILL.md" || !fs.existsSync(abs)) return null
  return abs
}

function collectSkillMd(input: ToolInput, result: ToolResult, directory: string): string | null {
  const candidates: unknown[] = [
    ...(result.metadata?.files ?? []).map((file) => file.filePath ?? file.relativePath),
    result.metadata?.filepath,
    result.metadata?.filePath,
    input.args?.filePath,
  ]
  for (const value of candidates) {
    const abs = toSkillMdPath(value, directory)
    if (abs) return abs
  }
  const title = typeof result.title === "string" ? result.title.trim() : ""
  if (title && !title.includes("\n")) return toSkillMdPath(title, directory)
  return null
}

export default Plugin.define({
  id: "skill-eval-remind",
  async setup(ctx) {
    if (process.env[KILL_SWITCH]) return
    const directory = ctx.location.directory

    await ctx.tool.hook("execute.after", (event) => {
      if (event.status !== "completed") return
      if (!EDIT_TOOLS.has(event.tool)) return
      const input = (event.input ?? {}) as ToolInput
      const result = (event.result ?? {}) as ToolResult
      const abs = collectSkillMd(input, result, directory)
      if (!abs) return
      const skillDir = path.dirname(abs)
      const skillName = path.basename(skillDir)
      const hasEvals = fs.existsSync(path.join(skillDir, "evals", "evals.json"))
      const headline = `SKILL.md (${skillName}) を編集しました。skill-management スキルの評価プロセスに従い、挙動に影響する変更の場合は eval を実行してください。`
      const guidance = hasEvals
        ? `evals/evals.json が存在します。eval スキルを実行し、対象を skill ${skillName} としてください。`
        : `evals/evals.json が存在しません。挙動に影響する変更の場合は skill-management スキルの4節に従って追加を検討してください。`
      const extra = `\n\n# skill-eval-remind\n${headline}\n${guidance}`
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
