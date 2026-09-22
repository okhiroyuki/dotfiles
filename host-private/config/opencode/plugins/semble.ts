// V2 plugin: registers semble_search / semble_find_related custom tools.

import { Plugin } from "@opencode/plugin"
import { spawnText } from "./lib/spawn.ts"

const CONTENT_TYPES = ["code", "docs", "config", "all"] as const

type SearchArgs = {
  path?: string
  top_k?: number
  max_snippet_lines?: number
  content?: string[]
}

async function runSemble(args: string[], cwd: string) {
  let res = await spawnText(["semble", ...args], { cwd })
  if (res.code === 127) {
    res = await spawnText(["uvx", "--from", "semble[mcp]", "semble", ...args], { cwd })
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

function commonProperties() {
  return {
    path: {
      type: "string",
      description: "Project directory to search (defaults to the session working directory)",
    },
    top_k: { type: "integer", minimum: 1, description: "Number of results (default 5)" },
    content: {
      type: "array",
      items: { type: "string", enum: [...CONTENT_TYPES] },
      description: "Content types to search; default is code only",
    },
    max_snippet_lines: {
      type: "integer",
      minimum: 0,
      description: "Lines of source per result (default: full chunk, 0 hides code)",
    },
  }
}

export default Plugin.define({
  id: "semble",
  async setup(ctx) {
    const directory = ctx.location.directory

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "semble_search",
        description:
          "Semantic code search via the semble CLI. Finds code by concept, symbol name, or intent and returns file:line snippets. Prefer this over grep/Read brute-force when looking for where something is implemented.",
        input: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Natural language or code query, e.g. 'authentication flow', 'retry logic'",
            },
            ...commonProperties(),
          },
          required: ["query"],
          additionalProperties: false,
        },
        async execute(input) {
          const args = input as SearchArgs & { query: string }
          const argv = ["search", args.query, ...commonFlags(args)]
          return { content: await runSemble(argv, args.path ?? directory) }
        },
      })

      editor.add({
        name: "semble_find_related",
        description:
          "Find implementations similar to a known location via the semble CLI. Pass a file path + line from semble_search results to discover related code.",
        input: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "File path as shown in search results",
            },
            line: { type: "integer", minimum: 1, description: "Line number in the file (1-indexed)" },
            ...commonProperties(),
          },
          required: ["file_path", "line"],
          additionalProperties: false,
        },
        async execute(input) {
          const args = input as SearchArgs & { file_path: string; line: number }
          const argv = ["find-related", args.file_path, String(args.line), ...commonFlags(args)]
          return { content: await runSemble(argv, args.path ?? directory) }
        },
      })
    })
  },
})
