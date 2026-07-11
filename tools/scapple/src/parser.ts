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
}

export function parseScap(filepath: string): ScapDocument {
  const xml = readFileSync(filepath, "utf-8");
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
    text: String(note.String ?? "").trim(),
    connectedTo: parseIdRange(note.ConnectedNoteIDs),
    pointsTo: parseIdRange(note.PointsToNoteIDs),
  }));
  const stacks: number[][] = rawStacks.map((s) => parseIdRange(s));

  return { notes, stacks };
}
