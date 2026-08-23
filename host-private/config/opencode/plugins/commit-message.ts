import type { Plugin } from "@opencode-ai/plugin"

const PREFIXES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "ci",
  "chore",
  "revert",
  "WIP",
]
const MAX_DESC = 50
const VAGUE = new Set(["fix", "update", "更新", "修正", "wip", "変更", "対応"])
const AI_SIGNATURES = ["Co-Authored-By: Claude", "Generated with Claude Code", "🤖"]

const PREFIX_RE = /^([A-Za-z]+)(\([^)]*\))?:\s*(.*)$/

function splitShellWords(input: string): string[] | null {
  const tokens: string[] = []
  let cur = ""
  let hasToken = false
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === "'") {
      const end = input.indexOf("'", i + 1)
      if (end === -1) return null
      cur += input.slice(i + 1, end)
      hasToken = true
      i = end + 1
    } else if (ch === '"') {
      hasToken = true
      i++
      let closed = false
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && ['"', "\\", "$", "`"].includes(input[i + 1])) {
          cur += input[i + 1]
          i += 2
        } else {
          cur += input[i]
          i++
        }
      }
      if (i >= input.length) return null
      i++
    } else if (ch === "\\") {
      if (i + 1 >= input.length) return null
      cur += input[i + 1]
      hasToken = true
      i += 2
    } else if (/\s/.test(ch)) {
      if (hasToken) tokens.push(cur)
      cur = ""
      hasToken = false
      i++
    } else {
      cur += ch
      hasToken = true
      i++
    }
  }
  if (hasToken) tokens.push(cur)
  return tokens
}

function messagesFrom(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if ((t === "-m" || t === "--message") && i + 1 < tokens.length) {
      out.push(tokens[i + 1])
      i++
    } else if (t.startsWith("--message=")) {
      out.push(t.slice("--message=".length))
    } else if (t.startsWith("-m") && t.length > 2) {
      out.push(t.slice(2))
    }
  }
  return out
}

function signatureViolations(text: string): string[] {
  return AI_SIGNATURES.filter((sig) => text.includes(sig)).map((sig) => `AI署名 \`${sig}\` を含めない`)
}

function violations(message: string): string[] {
  const subject = message.trim() ? message.split("\n")[0].trim() : ""
  const errs = signatureViolations(message)

  if (!subject) {
    errs.push("説明が空")
    return errs
  }

  const m = PREFIX_RE.exec(subject)
  let desc: string
  if (m) {
    if (!PREFIXES.includes(m[1])) {
      errs.push(`未知のプレフィックス \`${m[1]}\`。使えるのは: ${PREFIXES.join(", ")}`)
    }
    desc = m[3]
  } else {
    desc = subject
  }

  if ([...desc].length > MAX_DESC) {
    errs.push(`説明部分が${[...desc].length}文字（${MAX_DESC}文字以内）`)
  }
  if (VAGUE.has(desc.trim().toLowerCase())) {
    errs.push(`\`${desc}\` だけでは何を変えたか分からない`)
  }
  if (!/[ぁ-んァ-ヶ一-龠]/.test(desc)) {
    errs.push("説明部分は日本語で書く")
  }

  return errs
}

export const CommitMessagePlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return
      const command = output.args?.command
      if (typeof command !== "string" || !/\bgit\s+commit\b/.test(command)) return

      const tokens = splitShellWords(command)
      if (!tokens) return
      const msgs = messagesFrom(tokens)
      if (msgs.length === 0) return

      const errs = violations(msgs[0])
      for (const body of msgs.slice(1)) errs.push(...signatureViolations(body))
      if (errs.length === 0) return

      throw new Error(
        `コミットメッセージが規約に反しています:\n` +
          errs.map((e) => `  - ${e}`).join("\n") +
          `\n\n書式: \`<プレフィックス>: <日本語の説明>\`（説明は1行・50文字以内）\n` +
          `例:   \`docs: pre-commitルールにyamllint迂回手順を追加\``,
      )
    },
  }
}
