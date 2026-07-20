#!/usr/bin/env node
import { parseArgs } from "node:util";
import { parseScap } from "../src/parser.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    format: { type: "string", short: "f", default: "json" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log(`使い方: scapple <file.scap> [オプション]

オプション:
  -f, --format  出力形式: json | text  (デフォルト: json)
  -h, --help    ヘルプを表示`);
  process.exit(0);
}

if (values.format !== "json" && values.format !== "text") {
  console.error(`未知の形式: ${values.format}（json | text のいずれかを指定してください）`);
  process.exit(1);
}

const filepath = positionals[0];
let doc;
try {
  doc = parseScap(filepath);
} catch (e) {
  console.error(`エラー: ${filepath} を解析できませんでした: ${(e as Error).message}`);
  process.exit(1);
}

if (values.format === "text") {
  const byId = new Map(doc.notes.map((n) => [n.id, n.text]));
  const lines: string[] = [];
  for (const note of doc.notes) {
    lines.push(`[${note.id}] ${note.text}`);
    if (note.pointsTo.length) {
      lines.push(`  → ${note.pointsTo.map((id) => byId.get(id) ?? `#${id}`).join(", ")}`);
    }
    if (note.connectedTo.length) {
      lines.push(`  ─ ${note.connectedTo.map((id) => byId.get(id) ?? `#${id}`).join(", ")}`);
    }
  }
  for (const stack of doc.stacks) {
    lines.push(`\n[スタック] ${stack.map((id) => byId.get(id) ?? `#${id}`).join(" → ")}`);
  }
  console.log(lines.join("\n"));
} else {
  console.log(JSON.stringify(doc, null, 2));
}
