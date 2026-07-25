import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { parseIdRange } from "./id-range.js";

export interface ScapNote {
  id: number;
  text: string;
  connectedTo: number[];
  pointsTo: number[];
}

export interface ScapDocument {
  notes: ScapNote[];
  /** Scappleの「スタック」機能。縦に積まれた順序を持つノートIDの並び。 */
  stacks: number[][];
}

interface RawNote {
  "@_ID": string | number;
  String?: string | number;
  ConnectedNoteIDs?: string | number;
  PointsToNoteIDs?: string | number;
  /** テキストの代わりに画像を貼り付けたノート。本文は持たず、ファイル名のみプレースホルダとして拾う。 */
  ImageData?: { "@_Name"?: string };
}

/** String要素を持たない画像ノートは、本体データ(base64)を捨ててファイル名だけをプレースホルダ化する。 */
function extractText(note: RawNote): string {
  if (note.String !== undefined) return String(note.String).trim();
  if (note.ImageData?.["@_Name"]) return `[image: ${note.ImageData["@_Name"]}]`;
  return "";
}

export function parseScapXml(xml: string): ScapDocument {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "Note" || name === "Stack",
  });
  const data = parser.parse(xml);
  const rawNotes: RawNote[] = data?.ScappleDocument?.Notes?.Note ?? [];
  const rawStacks: (string | number)[] = data?.ScappleDocument?.Stacks?.Stack ?? [];

  // Scappleは矢印付きの線も両端の ConnectedNoteIDs に記録する。そのままでは1本の
  // 有向線が無向の関連としても現れてしまうので、矢印になっている組は無向から取り除く。
  const directed = new Set<string>();
  for (const note of rawNotes) {
    const from = Number(note["@_ID"]);
    for (const to of parseIdRange(note.PointsToNoteIDs)) {
      directed.add(from < to ? `${from}:${to}` : `${to}:${from}`);
    }
  }
  const isDirected = (a: number, b: number) => directed.has(a < b ? `${a}:${b}` : `${b}:${a}`);

  const notes: ScapNote[] = rawNotes.map((note) => {
    const id = Number(note["@_ID"]);
    return {
      id,
      text: extractText(note),
      connectedTo: parseIdRange(note.ConnectedNoteIDs).filter((to) => !isDirected(id, to)),
      pointsTo: parseIdRange(note.PointsToNoteIDs),
    };
  });
  const stacks: number[][] = rawStacks.map((s) => parseIdRange(s));

  return { notes, stacks };
}

export function parseScap(filepath: string): ScapDocument {
  return parseScapXml(readFileSync(filepath, "utf-8"));
}
