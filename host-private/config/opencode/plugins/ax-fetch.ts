// V2 plugin: registers the `ax` custom tool (ax CLI wrapper).
// V2 requires a default-exported Plugin.define({ id, setup }) and JSON Schema tool inputs.

import { Plugin } from "@opencode/plugin"
import { spawnText } from "./lib/spawn.ts"

export default Plugin.define({
  id: "ax-fetch",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "ax",
        description:
          "Fetch a URL or local file with the ax CLI (AI-era curl). Returns status, headers, and body; supports CSS-selector extraction (--row/--table), markdown conversion (--md), structure discovery (--outline/--locate), and curl-style flags (-X, -H, -d, -u, -I). Use this for all web fetching/scraping instead of curl.",
        input: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to fetch (http/https), or a file path / - for stdin",
            },
            selector: {
              type: "string",
              description: "CSS selector to extract from the page",
            },
            flags: {
              type: "array",
              items: { type: "string" },
              description:
                'Extra ax CLI flags and values as separate strings, e.g. ["--outline"] or ["--md", "--budget", "800"], ["-H", "authorization: Bearer x", "-X", "POST", "-d", \'{"a":1}\']',
            },
          },
          required: ["url"],
          additionalProperties: false,
        },
        async execute(input) {
          const args = input as { url: string; selector?: string; flags?: string[] }
          const argv = ["ax", args.url]
          if (args.selector) argv.push(args.selector)
          if (args.flags?.length) argv.push(...args.flags)
          const res = await spawnText(argv)
          return { content: res.stderr ? `${res.stdout}\n# stderr\n${res.stderr}` : res.stdout }
        },
      })
    })
  },
})
