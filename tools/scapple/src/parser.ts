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

  const notes: ScapNote[] = rawNotes.map((note) => ({
    id: Number(note["@_ID"]),
    text: extractText(note),
    connectedTo: parseIdRange(note.ConnectedNoteIDs),
    pointsTo: parseIdRange(note.PointsToNoteIDs),
  }));
  const stacks: number[][] = rawStacks.map((s) => parseIdRange(s));

  return { notes, stacks };
}

export function parseScap(filepath: string): ScapDocument {
  return parseScapXml(readFileSync(filepath, "utf-8"));
}
