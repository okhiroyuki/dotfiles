import { type Plugin, tool } from "@opencode-ai/plugin"

const CONTENT_TYPES = ["code", "docs", "config", "all"] as const

type SearchArgs = {
  path?: string
  top_k?: number
  max_snippet_lines?: number
  content?: string[]
}

async function spawnText(argv: string[], cwd: string) {
  try {
    const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", cwd })
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

async function runSemble(args: string[], cwd: string) {
  let res = await spawnText(["semble", ...args], cwd)
  if (res.code === 127) {
    res = await spawnText(["uvx", "--from", "semble[mcp]", "semble", ...args], cwd)
  }
  const out = res.stderr ? `${res.stdout}\n# stderr\n${res.stderr}` : res.stdout
  return res.code === 0 ? out : `${out}\n# exit code: ${res.code}`
}

function commonFlags(args: SearchArgs) {
  const flags: string[] = []
  if (args.top_k != null) flags.push("--top-k", String(args.top_k))
  if (args.max_snippet_lines != null) flags.push("--max-snippet-lines", String(args.max_snippet_lines))
  if (args.content?.length) flags.push("--content", ...args.content)
  return flags
}

function commonArgDefs() {
  return {
    path: tool.schema.string().optional().describe("Project directory or git URL to search (defaults to the session working directory)"),
    top_k: tool.schema.number().optional().describe("Number of results (default 5)"),
    content: tool.schema.array(tool.schema.enum(CONTENT_TYPES)).optional().describe("Content types to search; default is code only"),
    max_snippet_lines: tool.schema.number().optional().describe("Lines of source per result (default: full chunk, 0 hides code)"),
  }
}

export const SemblePlugin: Plugin = async () => {
  return {
    tool: {
      semble_search: tool({
        description:
          "Semantic code search via the semble CLI. Finds code by concept, symbol name, or intent and returns file:line snippets. Prefer this over grep/Read brute-force when looking for where something is implemented.",
        args: {
          query: tool.schema.string().describe("Natural language or code query, e.g. 'authentication flow', 'retry logic'"),
          ...commonArgDefs(),
        },
        async execute(args, ctx) {
          const argv = ["search", args.query, ...commonFlags(args)]
          return runSemble(argv, args.path ?? ctx.directory)
        },
      }),
      semble_find_related: tool({
        description:
          "Find implementations similar to a known location via the semble CLI. Pass a file path + line from semble_search results to discover related code.",
        args: {
          file_path: tool.schema.string().describe("File path as shown in search results"),
          line: tool.schema.number().describe("Line number in the file (1-indexed)"),
          ...commonArgDefs(),
        },
        async execute(args, ctx) {
          const argv = ["find-related", args.file_path, String(args.line), ...commonFlags(args)]
          return runSemble(argv, args.path ?? ctx.directory)
        },
      }),
    },
  }
}
