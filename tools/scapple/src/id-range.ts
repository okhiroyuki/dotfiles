/**
 * Scappleの ConnectedNoteIDs / PointsToNoteIDs は "1-3,5" のように
 * カンマ区切り・ハイフン範囲混在の文字列でIDを表す。
 */
/** 1つの範囲が展開してよいID数の上限。壊れた/悪意ある入力による巨大配列確保を防ぐ。 */
const MAX_RANGE_SIZE = 10_000;

/**
 * parseIdRangeの逆変換。連続する2つ以上のIDは "1-3" の範囲表記にまとめる。
 * 実ファイルの ConnectedNoteIDs が "1-2, 6-10, 28" と2連続からまとめているのに合わせている。
 *
 * 区切り文字は要素によって異なる。Scapple自身は ConnectedNoteIDs を ", " で、
 * AutoFit を "," で書き出すため、呼び出し側から指定する。
 */
export function formatIdRange(ids: number[], separator = ", "): string {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";

  const parts: string[] = [];
  let start = sorted[0]!;
  let prev = start;
  for (const id of sorted.slice(1)) {
    if (id === prev + 1) {
      prev = id;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = id;
    prev = id;
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(separator);
}

export function parseIdRange(value: string | number | undefined): number[] {
  if (value === undefined || value === "") return [];

  const ids: number[] = [];
  for (const part of String(value).split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes("-")) {
      // "1-2-3" のような多重ハイフンや "5-"/"-3" のような片側欠けは不正値として捨てる。
      const bounds = trimmed.split("-");
      if (bounds.length !== 2 || bounds[0] === "" || bounds[1] === "") continue;
      const start = Number(bounds[0]);
      const end = Number(bounds[1]);
      if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
      if (Math.abs(end - start) + 1 > MAX_RANGE_SIZE) continue;
      const step = start <= end ? 1 : -1;
      for (let i = start; step > 0 ? i <= end : i >= end; i += step) ids.push(i);
    } else {
      const id = Number(trimmed);
      if (Number.isInteger(id)) ids.push(id);
    }
  }
  return ids;
}
