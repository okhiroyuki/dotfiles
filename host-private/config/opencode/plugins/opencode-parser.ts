// V2 adapter for TejasS1233/opencode-parser.
// The package still exports the V1 plugin shape, so use its parser directly
// and register a native V2 tool here.

import path from "node:path"
import { mkdir } from "node:fs/promises"
import { Plugin } from "@opencode/plugin"
import { parseFile } from "opencode-parser/src/orchestrator.ts"

type ParseArgs = {
  filePath: string
  maxChars?: number
  extractTables?: boolean
  extractImages?: boolean
  ocrLang?: string
  maxPages?: number
  save?: boolean
  outputPath?: string
}

type ParseResult = Awaited<ReturnType<typeof parseFile>>

export default Plugin.define({
  id: "opencode-parser",
  async setup(ctx) {
    const directory = ctx.location.directory

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "parse",
        description:
          "Parse and extract text/content from PDF, DOCX, XLSX, CSV, PPTX, images (OCR), EPUB, HTML, XML, Markdown, Jupyter Notebooks, archives, and plain text files.",
        input: {
          type: "object",
          properties: {
            filePath: { type: "string", description: "Path to the file to parse" },
            maxChars: {
              type: "number",
              description: "Maximum characters to return (default: 50000; -1 means unlimited)",
            },
            extractTables: { type: "boolean", description: "Extract tables (default: true)" },
            extractImages: { type: "boolean", description: "Enable OCR for images (default: false)" },
            ocrLang: { type: "string", description: "OCR language (default: eng)" },
            maxPages: { type: "number", description: "Maximum pages, slides, sheets, or cells" },
            save: { type: "boolean", description: "Save the full output as Markdown beside the input file" },
            outputPath: { type: "string", description: "Custom Markdown output path" },
          },
          required: ["filePath"],
          additionalProperties: false,
        },
        async execute(input) {
          const args = input as ParseArgs
          const filePath = resolvePath(args.filePath, directory)
          const options = {
            filePath,
            maxChars: args.maxChars != null && args.maxChars < 0 ? undefined : (args.maxChars ?? 50000),
            extractTables: args.extractTables ?? true,
            extractImages: args.extractImages ?? false,
            ocrLang: args.ocrLang ?? "eng",
            maxPages: args.maxPages,
          }
          const result = await parseFile(options)
          const output = formatResult(result)

          if (args.save || args.outputPath) {
            const outputPath = resolvePath(
              args.outputPath ?? `${path.basename(filePath).replace(/\.[^.]+$/, "")}.md`,
              args.outputPath ? directory : path.dirname(filePath),
            )
            const fullResult = await parseFile({ ...options, maxChars: undefined })
            await mkdir(path.dirname(outputPath), { recursive: true })
            await Bun.write(outputPath, formatResult(fullResult))
          }

          return { content: output }
        },
      })
    })
  },
})

function resolvePath(value: string, base: string): string {
  return path.isAbsolute(value) ? value : path.resolve(base, value)
}

function formatResult(result: ParseResult): string {
  const lines: string[] = []
  lines.push(`## ${result.fileName} (${result.type.toUpperCase()}, ${formatSize(result.fileSize)})`, "")

  for (const [key, value] of Object.entries(result.meta).filter(([, value]) => value != null && value !== "")) {
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase())
    lines.push(`- **${label}**: ${value}`)
  }
  if (Object.keys(result.meta).length > 0) lines.push("")

  lines.push(
    `- Words: ${result.meta.wordCount ?? countWords(result.content.text)} | Chars: ${result.content.text.length.toLocaleString()}`,
    "",
  )

  if (result.content.truncated) {
    lines.push(
      `> **Note:** Content was truncated (${result.content.returnedChars.toLocaleString()} of ${result.content.totalChars.toLocaleString()} chars returned).`,
      "",
    )
  }

  if (result.tables?.length) {
    lines.push(`### Tables (${result.tables.length})`, "")
    for (const table of result.tables.slice(0, 5)) {
      if (table.name) lines.push(`**${table.name}:**`)
      if (table.headers.length) {
        lines.push(`| ${table.headers.join(" | ")} |`)
        lines.push(`| ${table.headers.map(() => "---").join(" | ")} |`)
      }
      for (const row of table.rows.slice(0, 20)) lines.push(`| ${row.join(" | ")} |`)
      lines.push("")
    }
  }

  if (result.archiveContents?.length) {
    lines.push(`### Archive Contents (${result.archiveContents.length})`, "")
    lines.push(...result.archiveContents.slice(0, 50).map((entry) => `- ${entry}`), "")
  }

  if (result.content.text) lines.push("### Content", "", result.content.text)
  return lines.join("\n")
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function countWords(text: string): number {
  const cleaned = text.replace(/[\x00-\x1F]/g, " ").trim()
  return cleaned ? cleaned.split(/\s+/).length : 0
}
