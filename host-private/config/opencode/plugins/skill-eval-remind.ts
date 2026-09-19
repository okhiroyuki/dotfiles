import fs from "node:fs"
import path from "node:path"
import { type Plugin } from "@opencode-ai/plugin"
import { which } from "./lib/spawn.ts"

const EDIT_TOOLS = new Set(["write", "edit", "apply_patch"])
const KILL_SWITCH = "SKILL_EVAL_REMIND_DISABLE"

type PatchFile = { filePath?: unknown; relativePath?: unknown }
type ToolOutput = {
  title?: unknown
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

function collectSkillMd(input: ToolInput, output: ToolOutput, directory: string): string | null {
  const candidates: unknown[] = [
    ...(output.metadata?.files ?? []).map((file) => file.filePath ?? file.relativePath),
    output.metadata?.filepath,
    output.metadata?.filePath,
    input.args?.filePath,
  ]
  for (const value of candidates) {
    const abs = toSkillMdPath(value, directory)
    if (abs) return abs
  }
  const title = typeof output.title === "string" ? output.title.trim() : ""
  if (title && !title.includes("\n")) return toSkillMdPath(title, directory)
  return null
}

export const SkillEvalRemindPlugin: Plugin = async ({ directory }) => {
  if (process.env[KILL_SWITCH]) return {}
  if (!which("opencode")) return {}
  return {
    "tool.execute.after": async (input, output) => {
      if (!EDIT_TOOLS.has(input.tool)) return
      const abs = collectSkillMd(input, output, directory)
      if (!abs) return
      const skillDir = path.dirname(abs)
      const skillName = path.basename(skillDir)
      const hasEvals = fs.existsSync(path.join(skillDir, "evals", "evals.json"))
      const headline = `SKILL.md (${skillName}) を編集しました。skill-management スキルの評価プロセスに従い、挙動に影響する変更の場合は eval を実行してください。`
      const guidance = hasEvals
        ? `evals/evals.json が存在します。/skill-eval ${skillName} で実行できます。`
        : `evals/evals.json が存在しません。挙動に影響する変更の場合は skill-management スキルの4節に従って追加を検討してください。`
      output.output = `${output.output ?? ""}\n\n# skill-eval-remind\n${headline}\n${guidance}`
    },
  }
}
