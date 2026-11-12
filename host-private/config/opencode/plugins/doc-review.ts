// V2 plugin: doc-review の opencode 版ゲート。
// Claude Code hooks (doc-review-state.py / doc-review.py) の状態ファイルを再利用する。
// 確認済み: execute.before での throw はツールをブロックする(commit-message.ts と同様)。
//           session.idle でのゲート文言は ctx.session.synthetic({sessionID, text}) で注入する。
// 未確認: subagent 判別に使えるフィールド(現在は区別せず記録)。
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

type PromptEvent = {
  sessionID?: string
  prompt?: { skills?: unknown[] }
}

type IdleEvent = { sessionID?: string; properties?: { sessionID?: string } }

const turns = new Map<string, number>()

function threshold(): number {
  // 書込前ゲートは Claude Code 版と同じ TECH_WRITING_GATE_THRESHOLD を共有する。
  // Python 側 int() と同じく値全体が整数のときだけ受け付け、不正値は既定値に戻す。
  const raw = process.env.TECH_WRITING_GATE_THRESHOLD ?? ""
  if (!/^-?\d+$/.test(raw)) return DEFAULT_THRESHOLD
  const parsed = Number.parseInt(raw, 10)
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
  const result = await spawnText([python, STATE_SCRIPT, mode], { stdin: JSON.stringify(payload) }).catch(
    (error) => ({ code: 127, stdout: "", stderr: String(error) }),
  )
  if (result.code !== 0) {
    // 記録失敗のまま黙ると、スキル起動済みでもゲートが誤ブロックする。可視化だけする。
    console.error(`doc-review: 状態記録に失敗しました (${mode}): ${result.stderr.trim()}`)
  }
}

// 子プロセスの終了を無期限に待つとロック待ちなどでセッションが停滞するため、
// 状態記録とゲートの呼び出しは有限の期限で打ち切る。打ち切りは理由とともに可視化する。
const CHILD_TIMEOUT_MS = 5000

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      console.error(`doc-review: ${label}がタイムアウトしました (${CHILD_TIMEOUT_MS}ms)`)
      resolve(undefined)
    }, CHILD_TIMEOUT_MS)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export default Plugin.define({
  id: "doc-review",
  async setup(ctx) {
    const limit = threshold()

    // ターン境界: ユーザープロンプトの承認ごとにターン番号を進める。
    // prompt.skills はスキル解決前に決まる一次情報。フック成否に依存しないためここでも記録する。
    await ctx.session.hook("prompt", async (event) => {
      const e = event as PromptEvent
      const sessionID = e.sessionID ?? "default"
      turns.set(sessionID, turnOf(sessionID) + 1)
      for (const skill of e.prompt?.skills ?? []) {
        if (typeof skill === "string") {
          await withTimeout(
            runStateScript("skill", {
              session_id: sessionID,
              prompt_id: String(turnOf(sessionID)),
              tool_input: { skill },
            }),
            "プロンプト時のスキル記録",
          )
        }
      }
    })

    // 書き込み前ゲート: 閾値を超える日本語をスキル未起動で書こうとしたら止める。
    await ctx.tool.hook("execute.before", (event) => {
      const e = event as ToolEvent
      const tool = (e.tool ?? "").toLowerCase()
      if (!WRITE_TOOLS.has(tool)) return
      const input = e.input ?? {}
      const file = filePathOf(input)
      if (!file.endsWith(".md") && !file.endsWith(".markdown")) return
      const count = (writtenTextOf(tool, input).match(JAPANESE_CHAR) ?? []).length
      if (count <= limit) return

      const sessionID = e.sessionID ?? "default"
      const skills = readState(sessionID)?.skills ?? []
      if (skills.some((s) => s.split(":").pop() === SKILL_NAME)) return

      throw new Error(
        `日本語の文章を ${count} 字書き込もうとしていますが、このターンで ${SKILL_NAME} スキルを起動していません。\n` +
          `先に skill ツールで ${SKILL_NAME} を起動し、その規則に沿って文章を見直してから書き込んでください。\n` +
          `コードや設定値が大半で文章の推敲が不要な場合は、書き込まずにユーザーへ理由を伝えてください。`,
      )
    })

    // 状態記録: V2 の execute.after は失敗時にも発火するため status を見る。
    // 記録完了を待たないとゲートが未記録の状態を読む競合が起きるため await する。
    await ctx.tool.hook("execute.after", async (event) => {
      const e = event as ToolEvent & { status?: string }
      if (e.status !== "completed") return
      const tool = (e.tool ?? "").toLowerCase()
      const input = e.input ?? {}
      const file = filePathOf(input)
      const skill = skillNameOf(input)
      const sessionID = e.sessionID ?? "default"
      const payload = { session_id: sessionID, prompt_id: String(turnOf(sessionID)) }

      if (WRITE_TOOLS.has(tool) && file) {
        await withTimeout(
          runStateScript("write", { ...payload, tool_input: { file_path: file } }),
          "書き込みの状態記録",
        )
      } else if (tool === "skill" && skill) {
        await withTimeout(
          runStateScript("skill", { ...payload, tool_input: { skill } }),
          "スキルの状態記録",
        )
      }
    })

    // ターン終了ゲート: exit 2 ならレビュー手順のメッセージをセッションに注入して促す。
    // 同一ターンで複数回の注入は無限ループになるため 1 回に制限する（stop_hook_active 相当）。
    const nudged = new Set<string>()
    void (async () => {
      const python = which("python3")
      if (!python || !fs.existsSync(GATE_SCRIPT)) return
      for await (const event of ctx.event.subscribe({ types: ["session.idle"] })) {
        const e = event as IdleEvent
        const sessionID = e.properties?.sessionID ?? e.sessionID ?? "default"
        const turn = String(turnOf(sessionID))
        const key = `${sessionID}:${turn}`
        if (nudged.has(key)) continue
        const payload = JSON.stringify({ session_id: sessionID, prompt_id: turn })
        const result = await withTimeout(
          spawnText([python, GATE_SCRIPT, "gate"], { stdin: payload }).catch(
            (error) => ({ code: 127, stdout: "", stderr: String(error) }),
          ),
          "ターン終了ゲート",
        )
        if (result && result.code === 2 && result.stderr) {
          nudged.add(key)
          try {
            await ctx.session.synthetic({ sessionID, text: result.stderr.trim() })
          } catch (error) {
            console.error(`doc-review: ターン継続の注入に失敗しました: ${String(error)}`)
          }
        }
      }
    })()
  },
})
