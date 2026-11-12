// OpenCode プラグイン（doc-review / spawn）のテスト。
// 実行: `node --test host-private/config/opencode/tests/` （mise run test から呼ばれる）
//
// Bun は Node 26 の型ストリッピングでテストを走らせるため globalThis.Bun が存在せず、
// spawnText は必ず Node フォールバック経路を通る。Bun 経路の動作は OpenCode サーバー
// （Bun ランタイム）での実機確認で担保する。
//
// プラグインの setup は実際の Python 状態スクリプトを spawn するため、状態は
// $TMPDIR/claude-doc-review/<sha256(sessionID:turn)>.json に書かれる。テストは
// ランダムな session ID を使い、状態の期待値は同じハッシュ計算で読み取って検証する。

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const plugin = (await import("../plugins/doc-review.ts")).default as {
  id: string
  setup: (ctx: unknown) => Promise<void>
}
const { spawnText } = await import("../plugins/lib/spawn.ts")

// ---- テスト用ヘルパ --------------------------------------------------------

// 閾値を小さくして境界を狙いやすくする。setup のたびに読まれる。
// TECH_WRITING_GATE_THRESHOLD は書込前ゲート（プラグイン）、
// DOC_REVIEW_THRESHOLD はターン終了ゲート（doc-review.py）の閾値。
process.env.TECH_WRITING_GATE_THRESHOLD = "5"
process.env.DOC_REVIEW_THRESHOLD = "5"

const jp = (count: number): string => "あいうえおかきくけこ".repeat(Math.ceil(count / 10)).slice(0, count)

const key = (sessionID: string, turn: number): string =>
  createHash("sha256").update(`${sessionID}:${turn}`).digest("hex")

const statePath = (sessionID: string, turn: number): string =>
  path.join(os.tmpdir(), "claude-doc-review", `${key(sessionID, turn)}.json`)

function readState(sessionID: string, turn: number): { written?: string[]; skills?: string[] } | null {
  try {
    return JSON.parse(fs.readFileSync(statePath(sessionID, turn), "utf8"))
  } catch {
    return null
  }
}

type AgentInfo = { id: string; mode: "subagent" | "primary" | "all" }
type SessionInfo = { parentID?: string | null }

function makeCtx(options: { agents: AgentInfo[]; sessions: Map<string, SessionInfo> }) {
  const sessionHook: Array<(event: unknown) => Promise<void> | void> = []
  const toolHooks: Record<string, Array<(event: unknown) => unknown>> = {}
  const synthetic: { sessionID: string; text: string }[] = []
  // session.wait の解決をテスト側から制御する（実機ではターン終了で解決する）
  const waitResolvers: Array<() => void> = []
  const ctx = {
    session: {
      hook: async (_name: string, cb: (event: unknown) => Promise<void> | void) => {
        sessionHook.push(cb)
        return {}
      },
      get: async ({ sessionID }: { sessionID: string }) =>
        options.sessions.get(sessionID) ?? { parentID: null },
      synthetic: async (input: { sessionID: string; text: string }) => {
        synthetic.push(input)
      },
      wait: async () =>
        new Promise<void>((resolve) => {
          waitResolvers.push(resolve)
        }),
    },
    tool: {
      hook: async (name: string, cb: (event: unknown) => unknown) => {
        ;(toolHooks[name] ??= []).push(cb)
        return {}
      },
    },
    agent: {
      list: async () => ({ data: options.agents }),
      get: async ({ agentID }: { agentID: string }) => ({
        data: options.agents.find((agent) => agent.id === agentID) ?? { id: agentID, mode: "primary" },
      }),
    },
  }
  return {
    ctx,
    synthetic,
    firePrompt: (event: { sessionID: string; prompt?: { skills?: string[] } }) =>
      Promise.all(sessionHook.map((hook) => hook(event))),
    fireBefore: (event: unknown) => toolHooks["execute.before"][0](event),
    fireAfter: (event: unknown) => Promise.all(toolHooks["execute.after"].map((hook) => hook(event))),
    // 待機中の session.wait をすべて解決し、ターン終了ゲートを走らせる
    resolveWaits: () => {
      for (const resolve of waitResolvers.splice(0)) resolve()
    },
  }
}

const newSession = (): string => `test-ses-${crypto.randomUUID()}`

const AGENTS: AgentInfo[] = [
  { id: "build", mode: "primary" },
  { id: "general", mode: "subagent" },
  { id: "explore", mode: "subagent" },
]

// ---- spawnText（Node フォールバック経路） ----------------------------------

test("spawnText: stdin が子プロセスに渡り stdout で返る", async () => {
  const result = await spawnText(["cat"], { stdin: "payload-text" })
  assert.equal(result.code, 0)
  assert.equal(result.stdout, "payload-text")
})

test("spawnText: stdout と stderr を分けて収集する", async () => {
  const result = await spawnText(["/bin/sh", "-c", "echo out; echo err 1>&2"])
  assert.equal(result.code, 0)
  assert.match(result.stdout, /out/)
  assert.match(result.stderr, /err/)
})

test("spawnText: 終了コードを伝える", async () => {
  const result = await spawnText(["/bin/sh", "-c", "exit 3"])
  assert.equal(result.code, 3)
})

test("spawnText: 存在しないコマンドは 127 を返す", async () => {
  const result = await spawnText(["definitely-missing-command-xyz"])
  assert.equal(result.code, 127)
  assert.notEqual(result.stderr, "")
})

// ---- 書込前ゲート（execute.before） ---------------------------------------

test("ゲート: スキル未起動で閾値を超える日本語 .md の書き込みを止める", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  assert.throws(() => {
    harness.fireBefore({
      tool: "write",
      sessionID: session,
      agent: "build",
      input: { file_path: "/tmp/doc.md", content: jp(10) },
    })
  }, /japanese-tech-writing/)
})

test("ゲート: 閾値未満の書き込みは止めない", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  harness.fireBefore({
    tool: "write",
    sessionID: session,
    agent: "build",
    input: { file_path: "/tmp/doc.md", content: jp(3) },
  })
})

test("ゲート: .md 以外は対象外", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  harness.fireBefore({
    tool: "write",
    sessionID: session,
    agent: "build",
    input: { file_path: "/tmp/doc.txt", content: jp(10) },
  })
})

test("ゲート: そのターンでスキルを起動していれば通す", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)
  await harness.firePrompt({ sessionID: session, prompt: { skills: ["japanese-tech-writing"] } })

  harness.fireBefore({
    tool: "write",
    sessionID: session,
    agent: "build",
    input: { file_path: "/tmp/doc.md", content: jp(10) },
  })
})

test("ゲート: 名前空間付きのスキル名も照合する", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)
  await harness.firePrompt({ sessionID: session, prompt: { skills: ["plugin:japanese-tech-writing"] } })

  harness.fireBefore({
    tool: "write",
    sessionID: session,
    agent: "build",
    input: { file_path: "/tmp/doc.md", content: jp(10) },
  })
})

test("ゲート: サブエージェントの書き込みは対象外", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  harness.fireBefore({
    tool: "write",
    sessionID: session,
    agent: "general",
    input: { file_path: "/tmp/doc.md", content: jp(10) },
  })
})

test("ゲート: 閾値ちょうどは通し、1字超えると止める", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  harness.fireBefore({
    tool: "write",
    sessionID: session,
    agent: "build",
    input: { file_path: "/tmp/doc.md", content: jp(5) },
  })
  assert.throws(() => {
    harness.fireBefore({
      tool: "write",
      sessionID: session,
      agent: "build",
      input: { file_path: "/tmp/doc.md", content: jp(6) },
    })
  }, /japanese-tech-writing/)
})

test("ゲート: multiedit の edits と代替パスキー・.markdown を判定する", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  assert.throws(() => {
    harness.fireBefore({
      tool: "multiedit",
      sessionID: session,
      agent: "build",
      input: { path: "/tmp/doc.markdown", edits: [{ new_string: jp(6) }] },
    })
  }, /japanese-tech-writing/)
})

test("ゲート: notebookedit も対象になる", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  assert.throws(() => {
    harness.fireBefore({
      tool: "notebookedit",
      sessionID: session,
      agent: "build",
      input: { file_path: "/tmp/doc.md", edits: [{ new_string: jp(6) }] },
    })
  }, /japanese-tech-writing/)
})

// ---- 状態記録（execute.after）とターン分離 --------------------------------

test("状態記録: completed の書き込みだけを記録する", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  await harness.fireAfter({
    tool: "write",
    sessionID: session,
    agent: "build",
    status: "completed",
    input: { file_path: "/tmp/a.md" },
  })
  await harness.fireAfter({
    tool: "write",
    sessionID: session,
    agent: "build",
    status: "error",
    input: { file_path: "/tmp/failed.md" },
  })

  // prompt フックを発火させていないのでターン番号は 0 のまま
  const state = readState(session, 0)
  assert.ok(state)
  assert.deepEqual(state.written, ["/tmp/a.md"])
})

test("状態記録: Skill 起動を記録し、ターンが進むと共有しない", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  await harness.firePrompt({ sessionID: session, prompt: { skills: ["japanese-tech-writing"] } })
  await harness.fireAfter({
    tool: "skill",
    sessionID: session,
    agent: "build",
    status: "completed",
    input: { skill: "japanese-tech-writing" },
  })
  await harness.firePrompt({ sessionID: session, prompt: {} })

  const first = readState(session, 1)
  assert.ok(first)
  assert.deepEqual(first.skills, ["japanese-tech-writing"])
  // turn 2 は Skill も書き込みも記録されていないので、状態ファイル自体が存在しない
  const second = readState(session, 2)
  assert.ok(second === null || (second.skills ?? []).length === 0)
})

test("状態記録: サブエージェントの書き込みは親セッションの状態に入る", async () => {
  const parent = newSession()
  const child = newSession()
  const harness = makeCtx({
    agents: AGENTS,
    sessions: new Map([[child, { parentID: parent }]]),
  })
  await plugin.setup(harness.ctx)
  await harness.firePrompt({ sessionID: parent, prompt: {} })

  await harness.fireAfter({
    tool: "write",
    sessionID: child,
    agent: "general",
    status: "completed",
    input: { file_path: "/tmp/by-subagent.md" },
  })

  const parentState = readState(parent, 1)
  assert.ok(parentState)
  assert.deepEqual(parentState.written, ["/tmp/by-subagent.md"])
  // 子セッションの状態には記録されない（親に集約される）
  const childState = readState(child, 1)
  assert.ok(childState === null || (childState.written ?? []).length === 0)
})

test("状態記録: 親が取れないサブエージェント書き込みは子セッションの状態に残る", async () => {
  const child = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)

  await harness.fireAfter({
    tool: "write",
    sessionID: child,
    agent: "general",
    status: "completed",
    input: { file_path: "/tmp/orphan.md" },
  })

  // prompt フック未発火なのでターン番号は 0 のまま
  const state = readState(child, 0)
  assert.ok(state)
  assert.deepEqual(state.written, ["/tmp/orphan.md"])
})

// ---- ターン終了ゲート（session.wait） ---------------------------------------
// 実機では session.idle イベントが配信されないため、プラグインはプロンプトごとに
// session.wait でターン終了を待ち、ゲートを走らせる。

const waitFor = async (fn: () => boolean, ms = 2000): Promise<void> => {
  const deadline = Date.now() + ms
  while (!fn()) {
    if (Date.now() > deadline) throw new Error("タイムアウト: 条件を満たしませんでした")
    await new Promise((r) => setTimeout(r, 20))
  }
}

test("ターン終了ゲート: wait 解決後にレビュー確認を注入する", async () => {
  const session = newSession()
  const doc = path.join(os.tmpdir(), `gate-doc-${crypto.randomUUID()}.md`)
  fs.writeFileSync(doc, jp(10))
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)
  await harness.firePrompt({ sessionID: session, prompt: {} })
  await harness.fireAfter({
    tool: "write",
    sessionID: session,
    agent: "build",
    status: "completed",
    input: { file_path: doc },
  })
  harness.resolveWaits()

  await waitFor(() => harness.synthetic.length > 0)
  assert.equal(harness.synthetic.length, 1)
  assert.equal(harness.synthetic[0].sessionID, session)
  assert.match(harness.synthetic[0].text, /閾値を超えています/)
  assert.match(harness.synthetic[0].text, new RegExp(doc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
})

test("ターン終了ゲート: 次のターンでは再び注入する", async () => {
  const session = newSession()
  const doc = path.join(os.tmpdir(), `gate-doc-${crypto.randomUUID()}.md`)
  fs.writeFileSync(doc, jp(10))
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)
  await harness.firePrompt({ sessionID: session, prompt: {} })
  await harness.fireAfter({
    tool: "write",
    sessionID: session,
    agent: "build",
    status: "completed",
    input: { file_path: doc },
  })
  harness.resolveWaits()
  await waitFor(() => harness.synthetic.length > 0)

  // ターン2: 同じ文書をさらに書き換えると、新しいターンのキーで再度注入する
  await harness.firePrompt({ sessionID: session, prompt: {} })
  fs.writeFileSync(doc, jp(20))
  await harness.fireAfter({
    tool: "edit",
    sessionID: session,
    agent: "build",
    status: "completed",
    input: { file_path: doc, new_string: jp(20) },
  })
  harness.resolveWaits()
  await waitFor(() => harness.synthetic.length > 1)
  assert.equal(harness.synthetic.length, 2)
})

test("ターン終了ゲート: 書き込みがなければ注入しない", async () => {
  const session = newSession()
  const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
  await plugin.setup(harness.ctx)
  await harness.firePrompt({ sessionID: session, prompt: {} })
  harness.resolveWaits()

  // ゲートスクリプトが fail open で抜けるのを待つ
  await new Promise((r) => setTimeout(r, 300))
  assert.equal(harness.synthetic.length, 0)
})

// ---- スクリプトが無い環境では何もしない ------------------------------------

test("setup: 状態スクリプトが無くても setup が完走する", async () => {
  const script = path.join(os.tmpdir(), `missing-state-${crypto.randomUUID()}.py`)
  const original = process.env.HOME
  process.env.HOME = path.dirname(script) // ~/.claude/hooks が見つからない HOME を渡す
  try {
    const session = newSession()
    const harness = makeCtx({ agents: AGENTS, sessions: new Map() })
    await plugin.setup(harness.ctx)
    await harness.fireAfter({
      tool: "write",
      sessionID: session,
      agent: "build",
      status: "completed",
      input: { file_path: "/tmp/never-recorded.md" },
    })
  } finally {
    process.env.HOME = original
  }
})
