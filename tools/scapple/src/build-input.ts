import type { ScapDocument, ScapNote } from "./parser.js";

/** 入力JSONが仕様を満たさないときに投げる。CLIはこのメッセージをそのまま利用者に見せる。 */
export class InvalidInputError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIdList(value: unknown, where: string): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new InvalidInputError(`${where} は数値の配列で指定してください`);
  return value.map((id) => {
    if (!Number.isInteger(id)) throw new InvalidInputError(`${where} に整数でない値があります: ${JSON.stringify(id)}`);
    return id as number;
  });
}

function parseNotes(value: unknown): ScapNote[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidInputError("notes は1つ以上の要素を持つ配列で指定してください");
  }

  const seen = new Set<number>();
  return value.map((raw, index) => {
    if (!isRecord(raw)) throw new InvalidInputError(`notes[${index}] はオブジェクトで指定してください`);
    const { id, text } = raw;
    if (!Number.isInteger(id) || (id as number) < 0) {
      throw new InvalidInputError(`notes[${index}].id は0以上の整数で指定してください`);
    }
    if (seen.has(id as number)) throw new InvalidInputError(`id が重複しています: ${id}`);
    seen.add(id as number);
    if (text !== undefined && typeof text !== "string") {
      throw new InvalidInputError(`notes[${index}].text は文字列で指定してください`);
    }

    return {
      id: id as number,
      text: (text as string | undefined) ?? "",
      connectedTo: toIdList(raw.connectedTo, `notes[${index}].connectedTo`),
      pointsTo: toIdList(raw.pointsTo, `notes[${index}].pointsTo`),
    };
  });
}

function parseStacks(value: unknown, known: Set<number>): number[][] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new InvalidInputError("stacks は配列の配列で指定してください");

  const stacked = new Set<number>();
  return value.map((stack, index) => {
    const ids = toIdList(stack, `stacks[${index}]`);
    for (const id of ids) {
      if (!known.has(id)) throw new InvalidInputError(`stacks[${index}] が存在しないノートID ${id} を参照しています`);
      // Scappleでは1つのノートが2つの縦積みに同時に属することはできない。
      if (stacked.has(id)) throw new InvalidInputError(`ノートID ${id} が複数のスタックに含まれています`);
      stacked.add(id);
    }
    return ids;
  });
}

/**
 * 生のJSONを検証してScapDocumentへ正規化する。
 *
 * 無向の接続は、Scappleの実ファイルが常に両側に相手のIDを持っているのに合わせて
 * 片側だけの記述を対称化する。自分自身への参照は線を引きようがないので落とす。
 */
export function normalizeBuildInput(raw: unknown): ScapDocument {
  if (!isRecord(raw)) throw new InvalidInputError("入力はオブジェクト形式のJSONで指定してください");

  const notes = parseNotes(raw.notes);
  const known = new Set(notes.map((n) => n.id));
  const stacks = parseStacks(raw.stacks, known);

  const connections = new Map(notes.map((n) => [n.id, new Set<number>()]));
  for (const note of notes) {
    for (const target of note.connectedTo) {
      if (!known.has(target)) {
        throw new InvalidInputError(`ノートID ${note.id} の connectedTo が存在しないノートID ${target} を参照しています`);
      }
      if (target === note.id) continue;
      connections.get(note.id)!.add(target);
      connections.get(target)!.add(note.id);
    }
    for (const target of note.pointsTo) {
      if (!known.has(target)) {
        throw new InvalidInputError(`ノートID ${note.id} の pointsTo が存在しないノートID ${target} を参照しています`);
      }
    }
  }

  return {
    notes: notes.map((note) => ({
      ...note,
      connectedTo: [...connections.get(note.id)!].sort((a, b) => a - b),
      pointsTo: [...new Set(note.pointsTo.filter((id) => id !== note.id))].sort((a, b) => a - b),
    })),
    stacks,
  };
}
