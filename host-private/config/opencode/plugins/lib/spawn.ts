import { execFile } from "node:child_process"
import { promisify } from "node:util"
import fs from "node:fs"
import path from "node:path"

const execFileAsync = promisify(execFile)

type BunProcess = {
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
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
      const proc = bun.spawn(resolved, {
        stdout: "pipe",
        stderr: "pipe",
        stdin: options.stdin === undefined ? "inherit" : "pipe",
        cwd: options.cwd,
      })
      if (options.stdin !== undefined) proc.stdin.write(options.stdin)
      await proc.stdin.end()
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
    // node フォールバックは stdin を渡せないため spawnSync を使う(実運用は Bun 経由)。
    if (options.stdin !== undefined) {
      const { spawnSync } = await import("node:child_process")
      const result = spawnSync(resolved[0], resolved.slice(1), {
        cwd: options.cwd,
        input: options.stdin,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      })
      return {
        code: result.status ?? 127,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      }
    }
    const { stdout, stderr } = await execFileAsync(resolved[0], resolved.slice(1), {
      cwd: options.cwd,
      maxBuffer: 32 * 1024 * 1024,
    })
    return { code: 0, stdout, stderr }
  } catch (error) {
    const err = error as { code?: number | string; stdout?: string; stderr?: string; message?: string }
    return {
      code: typeof err.code === "number" ? err.code : 127,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? String(error),
    }
  }
}
