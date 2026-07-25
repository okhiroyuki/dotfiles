import { randomUUID } from "node:crypto";
import type { ScapDocument } from "./parser.js";
import { formatIdRange } from "./id-range.js";
import { layout } from "./layout.js";

/** ノートの初期幅。AutoFitに全ノートを登録するので、Scappleが開いた時点で内容に合わせて調整される。 */
const NOTE_WIDTH = "100.0";
const FONT_SIZE = "12.0";

export interface BuildOptions {
  /** ドキュメントID。省略時はUUIDを生成する（テストで固定値を渡すために外から差せる）。 */
  documentId?: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * ノートごとの ConnectedNoteIDs を組み立てる。
 *
 * Scappleは線が引かれているノート同士にしか矢尻を描かないため、有向の接続も線として
 * 登録する。PointsToNoteIDsだけを書いたノートは線も矢印も表示されない。
 * 線は両端のノートが互いのIDを持つ必要があるので、向きにかかわらず双方に入れる。
 */
function collectConnections(doc: ScapDocument): Map<number, Set<number>> {
  const connections = new Map(doc.notes.map((n) => [n.id, new Set<number>()]));
  for (const note of doc.notes) {
    for (const target of [...note.connectedTo, ...note.pointsTo]) {
      if (target === note.id || !connections.has(target)) continue;
      connections.get(note.id)!.add(target);
      connections.get(target)!.add(note.id);
    }
  }
  return connections;
}

/** Scappleは座標を小数1桁で書き出すので、それに揃える。 */
function formatCoordinate(value: number): string {
  return value.toFixed(1);
}

/**
 * ScapDocumentからScappleが開ける.scap XMLを組み立てる。
 *
 * 座標は入力に含まれないため、layout()が接続関係から機械的に決める。
 * 色・フォント・背景図形といった外観設定は書かず、Scapple側の既定値に任せる。
 */
export function buildScapXml(doc: ScapDocument, options: BuildOptions = {}): string {
  const positions = layout(doc);
  const connections = collectConnections(doc);
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<ScappleDocument Version="1.2" ID="${options.documentId ?? randomUUID().toUpperCase()}">`,
    "  <Notes>",
  ];

  for (const note of doc.notes) {
    const { x, y } = positions.get(note.id) ?? { x: 0, y: 0 };
    const position = `${formatCoordinate(x)},${formatCoordinate(y)}`;
    lines.push(
      `    <Note ID="${note.id}" FontSize="${FONT_SIZE}" Position="${position}" Width="${NOTE_WIDTH}">`,
      "      <Appearance>",
      "        <Alignment>Left</Alignment>",
      "      </Appearance>",
      `      <String>${escapeXml(note.text)}</String>`,
    );
    const connected = [...(connections.get(note.id) ?? [])].sort((a, b) => a - b);
    if (connected.length > 0) {
      lines.push(`      <ConnectedNoteIDs>${formatIdRange(connected)}</ConnectedNoteIDs>`);
    }
    if (note.pointsTo.length > 0) {
      // PointsToNoteIDsだけは連続IDでも範囲表記にせず "6,7,8,9" と列挙する。
      lines.push(`      <PointsToNoteIDs>${note.pointsTo.join(",")}</PointsToNoteIDs>`);
    }
    lines.push("    </Note>");
  }
  lines.push("  </Notes>");

  const stacks = doc.stacks.filter((stack) => stack.length > 0);
  if (stacks.length > 0) {
    lines.push("  <Stacks>");
    // スタックは並び順が意味を持つので、範囲表記でIDを昇順に潰さずそのまま列挙する。
    for (const stack of stacks) lines.push(`    <Stack>${stack.join(",")}</Stack>`);
    lines.push("  </Stacks>");
  }

  lines.push(
    `  <AutoFit>${formatIdRange(doc.notes.map((n) => n.id), ",")}</AutoFit>`,
    "  <UISettings>",
    "    <DefaultFont>Helvetica</DefaultFont>",
    "    <NoteXPadding>8.0</NoteXPadding>",
    "  </UISettings>",
    "</ScappleDocument>",
    "",
  );
  return lines.join("\n");
}
