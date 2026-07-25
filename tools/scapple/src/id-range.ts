/**
 * Scappleの ConnectedNoteIDs / PointsToNoteIDs は "1-3,5" のように
 * カンマ区切り・ハイフン範囲混在の文字列でIDを表す。
 */
/** 1つの範囲が展開してよいID数の上限。壊れた/悪意ある入力による巨大配列確保を防ぐ。 */
const MAX_RANGE_SIZE = 10_000;

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
