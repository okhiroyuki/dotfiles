// V2 plugin: doc-review の opencode 版ゲート。
// Claude Code hooks (doc-review-state.py / doc-review.py) の状態ファイルを再利用する。
// 確認済み: execute.before での throw はツールをブロックする(commit-message.ts と同様)。
// 未確認: session.idle の正確なペイロード、subagent 判別に使えるフィールド(現在は区別せず記録)。
// 識別子は Claude Code の session_id/prompt_id に sessionID/ターン番号を対応させる。

import { Plugin } from "@opencode/plugin"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { spawnText, which } from "./lib/spawn.ts"

const SKILL_NAME = "japanese-tech-writing"
const DEFAULT_THRESHOLD = 400
const JAPANESE_CHAR = /[\u3040-\u30FF\u4E00-\u9FFF]/g
const WRITE_TOOLS = new Set(["write", "edit", "multiedit", "notebookedit"])
const STATE_SCRIPT = path.join(os.homedir(), ".claude", "hooks", "doc-review-state.py")
const GATE_SCRIPT = path.join(os.homedir(), ".claude", "hooks", "doc-review.py")
const STATE_ROOT = path.join(os.tmpdir(), "claude-doc-review")

type ToolEvent = {
  tool: string
  input?: Record<string, unknown>
  sessionID?: string
}

type IdleEvent = { sessionID?: string }

const turns = new Map<string, number>()

function threshold(): number {
  const parsed = Number.parseInt(process.env.DOC_REVIEW_THRESHOLD ?? "", 10)
  return Number.isFinite(parsed) ? parsed : DEFAULT_THRESHOLD
}

function turnOf(sessionID: string): number {
  return turns.get(sessionID) ?? 0
}

function stateFile(sessionID: string): string | null {
  const turn = turnOf(sessionID)
  if (!sessionID || turn === 0) return null
  const key = createHash("sha256").update(`${sessionID}:${turn}`).digest("hex")
  return path.join(STATE_ROOT, `${key}.json`)
}

function readState(sessionID: string): { written?: string[]; skills?: string[] } | null {
  const file = stateFile(sessionID)
  if (!file) return null
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as { written?: string[]; skills?: string[] }
  } catch {
    return null
  }
}

function filePathOf(input: Record<string, unknown>): string {
  for (const key of ["file_path", "filePath", "path"]) {
    const value = input[key]
    if (typeof value === "string") return value
  }
  return ""
}

function skillNameOf(input: Record<string, unknown>): string {
  for (const key of ["skill", "id", "name"]) {
    const value = input[key]
    if (typeof value === "string") return value
  }
  return ""
}

function writtenTextOf(tool: string, input: Record<string, unknown>): string {
  if (tool === "write") return typeof input.content === "string" ? input.content : ""
  if (tool === "edit") return typeof input.new_string === "string" ? input.new_string : ""
  if (tool === "multiedit" || tool === "notebookedit") {
    const edits = Array.isArray(input.edits) ? input.edits : []
    return edits
      .map((edit) => (edit as { new_string?: unknown } | null)?.new_string)
      .filter((text): text is string => typeof text === "string")
      .join("\n")
  }
  return ""
}

async function runStateScript(mode: "write" | "skill", payload: Record<string, unknown>): Promise<void> {
  const python = which("python3")
  if (!python || !fs.existsSync(STATE_SCRIPT)) return
  await spawnText([python, STATE_SCRIPT, mode], { stdin: JSON.stringify(payload) }).catch(() => undefined)
}

export default Plugin.define({
  id: "doc-review",
  async setup(ctx) {
    const limit = threshold()

    // ターン境界: ユーザープロンプトの承認ごとにターン番号を進める。
    await ctx.session.hook("prompt", (event) => {
      const sessionID = (event as { sessionID?: string }).sessionID ?? "default"
      turns.set(sessionID, turnOf(sessionID) + 1)
    })

    // 書き込み前ゲート: 閾値以上の日本語をスキル未起動で書こうとしたら止める。
    await ctx.tool.hook("execute.before", (event) => {
      const e = event as ToolEvent
      const tool = (e.tool ?? "").toLowerCase()
      if (!WRITE_TOOLS.has(tool)) return
      const input = e.input ?? {}
      const file = filePathOf(input)
      if (!file.endsWith(".md") && !file.endsWith(".markdown")) return
      const count = (writtenTextOf(tool, input).match(JAPANESE_CHAR) ?? []).length
      if (count < limit) return

      const sessionID = e.sessionID ?? "default"
      const skills = readState(sessionID)?.skills ?? []
      if (skills.some((s) => s.split(":").pop() === SKILL_NAME)) return

      throw new Error(
        `日本語の文章を ${count} 字書き込もうとしていますが、このターンで ${SKILL_NAME} スキルを起動していません。\n` +
          `先に skill ツールで ${SKILL_NAME} を起動し、その規則に沿って文章を見直してから書き込んでください。\n` +
          `コードや設定値が大半で文章の推敲が不要な場合は、書き込まずにユーザーへ理由を伝えてください。`,
      )
    })

    // 状態記録: 書き込みとスキル起動を Python 側の状態ファイルに渡す。
    await ctx.tool.hook("execute.after", (event) => {
      const e = event as ToolEvent
      const tool = (e.tool ?? "").toLowerCase()
      const input = e.input ?? {}
      const file = filePathOf(input)
      const skill = skillNameOf(input)
      const sessionID = e.sessionID ?? "default"
      const payload = { session_id: sessionID, prompt_id: String(turnOf(sessionID)) }

      if (WRITE_TOOLS.has(tool) && file) {
        void runStateScript("write", { ...payload, tool_input: { file_path: file } })
      } else if (tool === "skill" && skill) {
        void runStateScript("skill", { ...payload, tool_input: { skill } })
      }
    })

    // ターン終了ゲート: exit 2 ならレビュー手順のメッセージを標準エラーに出す。
    // TODO: Claude Code 版と同様に ctx.session.synthetic でメッセージを注入する。
    void (async () => {
      const python = which("python3")
      if (!python || !fs.existsSync(GATE_SCRIPT)) return
      for await (const event of ctx.event.subscribe({ types: ["session.idle"] })) {
        const e = event as IdleEvent
        const sessionID = e.sessionID ?? "default"
        const payload = JSON.stringify({ session_id: sessionID, prompt_id: String(turnOf(sessionID)) })
        const result = await spawnText([python, GATE_SCRIPT, "gate"], { stdin: payload }).catch(() => undefined)
        if (result && result.code === 2 && result.stderr) {
          console.error(`doc-review: ${result.stderr.trim()}`)
        }
      }
    })()
  },
})
