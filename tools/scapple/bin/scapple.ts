#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseScap } from "../src/parser.js";
import { normalizeBuildInput, InvalidInputError } from "../src/build-input.js";
import { buildScapXml } from "../src/builder.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    format: { type: "string", short: "f", default: "json" },
    output: { type: "string", short: "o" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

const HELP = `使い方:
  scapple <file.scap> [オプション]        .scap を構造化データに変換する
  scapple build [file.json] [オプション]  構造化データから .scap を生成する

オプション:
  -f, --format  出力形式: json | text  (デフォルト: json、変換時のみ)
  -o, --output  出力先ファイル          (デフォルト: 標準出力、生成時のみ)
  -h, --help    ヘルプを表示

build の入力は {"notes": [{"id": 0, "text": "...", "connectedTo": [], "pointsTo": []}], "stacks": [[0, 1]]}
形式のJSON。ファイル名を省略するか - を渡すと標準入力から読む。`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function emit(content: string): void {
  if (values.output) writeFileSync(values.output, content);
  else process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
}

if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(0);
}

if (positionals[0] === "build") {
  const source = positionals[1];
  let raw: string;
  try {
    raw = readFileSync(source && source !== "-" ? source : 0, "utf-8");
  } catch (e) {
    fail(`エラー: 入力を読み込めませんでした: ${(e as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`エラー: 入力がJSONとして解析できませんでした: ${(e as Error).message}`);
  }

  try {
    emit(buildScapXml(normalizeBuildInput(parsed)));
  } catch (e) {
    if (e instanceof InvalidInputError) fail(`エラー: ${e.message}`);
    throw e;
  }
} else {
  if (values.format !== "json" && values.format !== "text") {
    fail(`未知の形式: ${values.format}（json | text のいずれかを指定してください）`);
  }

  const filepath = positionals[0];
  let doc;
  try {
    doc = parseScap(filepath);
  } catch (e) {
    fail(`エラー: ${filepath} を解析できませんでした: ${(e as Error).message}`);
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
    emit(lines.join("\n"));
  } else {
    emit(JSON.stringify(doc, null, 2));
  }
}
