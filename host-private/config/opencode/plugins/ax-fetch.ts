import { type Plugin, tool } from "@opencode-ai/plugin"

export const AxFetchPlugin: Plugin = async () => {
  return {
    tool: {
      ax: tool({
        description:
          "Fetch a URL or local file with the ax CLI (AI-era curl). Returns status, headers, and body; supports CSS-selector extraction (--row/--table), markdown conversion (--md), structure discovery (--outline/--locate), and curl-style flags (-X, -H, -d, -u, -I). Use this for all web fetching/scraping instead of curl.",
        args: {
          url: tool.schema
            .string()
            .describe("URL to fetch (http/https), or a file path / - for stdin"),
          selector: tool.schema
            .string()
            .optional()
            .describe("CSS selector to extract from the page"),
          flags: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe(
              'Extra ax CLI flags and values as separate strings, e.g. ["--outline"] or ["--md", "--budget", "800"], ["-H", "authorization: Bearer x", "-X", "POST", "-d", \'{"a":1}\']',
            ),
        },
        async execute(args) {
          const argv = ["ax", args.url]
          if (args.selector) argv.push(args.selector)
          if (args.flags?.length) argv.push(...args.flags)
          const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" })
          const [stdout, stderr] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
          ])
          await proc.exited
          return stderr ? `${stdout}\n# stderr\n${stderr}` : stdout
        },
      }),
    },
  }
}
