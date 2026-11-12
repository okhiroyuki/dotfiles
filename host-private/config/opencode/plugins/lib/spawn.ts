import fs from "node:fs"
import path from "node:path"

type BunProcess = {
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
  stdin?: { write(data: string): number; end(): number }
  exited: Promise<number>
}

type BunApi = {
  which?: (bin: string) => string | null
  spawn?: (argv: string[], options: { cwd?: string; stdout: "pipe"; stderr: "pipe" }) => BunProcess
}

const bun = (globalThis as typeof globalThis & { Bun?: BunApi }).Bun

const EXTRA_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  path.join(process.env.HOME ?? "", ".local", "bin"),
  path.join(process.env.HOME ?? "", ".local", "share", "mise", "shims"),
]

function searchDirs(): string[] {
  const fromPath = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)
  return [...new Set([...fromPath, ...EXTRA_DIRS].filter(Boolean))]
}

export type SpawnResult = { code: number; stdout: string; stderr: string }

export function which(bin: string): string | null {
  if (bin.includes(path.sep)) {
    try {
      fs.accessSync(bin, fs.constants.X_OK)
      return bin
    } catch {
      return null
    }
  }
  if (bun?.which) {
    const found = bun.which(bin)
    if (found) return found
  }
  for (const dir of searchDirs()) {
    const candidate = path.join(dir, bin)
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {
      // not executable or missing; try next
    }
  }
  return null
}

function resolveArgv(argv: string[]): string[] {
  const [head, ...rest] = argv
  if (path.isAbsolute(head)) return argv
  const found = which(head)
  return found ? [found, ...rest] : argv
}

export async function spawnText(
  argv: string[],
  options: { cwd?: string; stdin?: string } = {},
): Promise<SpawnResult> {
  const resolved = resolveArgv(argv)
  if (bun?.spawn) {
    try {
      const piped = options.stdin !== undefined
      const proc = bun.spawn(resolved, {
        stdout: "pipe",
        stderr: "pipe",
        stdin: piped ? "pipe" : "inherit",
        cwd: options.cwd,
      })
      if (piped && proc.stdin) {
        proc.stdin.write(options.stdin)
        await proc.stdin.end()
      }
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      const code = await proc.exited
      return { code, stdout, stderr }
    } catch (error) {
      return { code: 127, stdout: "", stderr: String(error) }
    }
  }
  try {
    // Bun がない環境でもイベントループを塞がないよう非同期 spawn を使う。
    const { spawn } = await import("node:child_process")
    const child = spawn(resolved[0], resolved.slice(1), { cwd: options.cwd })
    let stdout = ""
    let stderr = ""
    child.stdout!.setEncoding("utf8")
    child.stderr!.setEncoding("utf8")
    child.stdout!.on("data", (chunk: string) => {
      stdout += chunk
    })
    child.stderr!.on("data", (chunk: string) => {
      stderr += chunk
    })
    if (options.stdin !== undefined) child.stdin!.end(options.stdin)
    const code: number = await new Promise((resolve, reject) => {
      child.on("error", reject)
      child.on("close", (exit) => resolve(exit ?? 127))
    })
    return { code, stdout, stderr }
  } catch (error) {
    const err = error as { code?: number | string; message?: string }
    return {
      code: typeof err.code === "number" ? err.code : 127,
      stdout: "",
      stderr: err.message ?? String(error),
    }
  }
}
