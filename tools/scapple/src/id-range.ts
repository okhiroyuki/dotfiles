/**
 * Scappleの ConnectedNoteIDs / PointsToNoteIDs は "1-3,5" のように
 * カンマ区切り・ハイフン範囲混在の文字列でIDを表す。
 */
export function parseIdRange(value: string | number | undefined): number[] {
  if (value === undefined || value === "") return [];

  const ids: number[] = [];
  for (const part of String(value).split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const start = Number(startStr);
      const end = Number(endStr);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      const step = start <= end ? 1 : -1;
      for (let i = start; step > 0 ? i <= end : i >= end; i += step) ids.push(i);
    } else {
      const id = Number(trimmed);
      if (!Number.isNaN(id)) ids.push(id);
    }
  }
  return ids;
}
