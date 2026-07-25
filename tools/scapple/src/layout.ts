import type { ScapDocument } from "./parser.js";

export interface Point {
  x: number;
  y: number;
}

/** 列の横間隔。ノート幅100 + 余白100で、接続線が読める程度に離す。 */
const COLUMN_WIDTH = 200;
/**
 * FontSize 12 の1行ノートの高さ。実ファイルの縦積み（484.1 → 516.0 → 548.0）の
 * 間隔から求めた値で、スタックはこの間隔で並べないと縦積みとして描画されない。
 */
const NOTE_HEIGHT = 32;
/** 2行目以降の1行あたりの高さ。実測値がないため NOTE_HEIGHT の行送りからの推定。 */
const LINE_HEIGHT = 16;
/** 独立したノート同士の縦マージン。スタックと違い密着させる必要がないので余白を取る。 */
const ROW_GAP = 28;
/** 連結成分同士を分けるための縦マージン。 */
const COMPONENT_GAP = 80;

function noteHeight(text: string): number {
  return NOTE_HEIGHT + (text.split("\n").length - 1) * LINE_HEIGHT;
}

/**
 * レイアウトの最小単位。スタックは列の中で分断されると縦積みが崩れるため、
 * 単独ノートと同じく1つのユニットとして扱い、内部で縦に並べる。
 */
interface Unit {
  /** 縦に並ぶノートID。単独ノートなら長さ1。 */
  ids: number[];
  isStack: boolean;
}

function buildUnits(doc: ScapDocument): Unit[] {
  const existing = new Set(doc.notes.map((n) => n.id));
  const stacked = new Set<number>();
  const units: Unit[] = [];

  for (const stack of doc.stacks) {
    const ids = stack.filter((id) => existing.has(id) && !stacked.has(id));
    if (ids.length === 0) continue;
    for (const id of ids) stacked.add(id);
    units.push({ ids, isStack: true });
  }
  for (const note of doc.notes) {
    if (stacked.has(note.id)) continue;
    units.push({ ids: [note.id], isStack: false });
  }
  return units;
}

/** ユニットが占める縦幅。スタックは内部を密着させ、ユニット同士は余白で離す。 */
function unitHeight(unit: Unit, heightOf: Map<number, number>): number {
  const inner = unit.ids.reduce((sum, id) => sum + (heightOf.get(id) ?? NOTE_HEIGHT), 0);
  return inner + ROW_GAP;
}

/** ユニット間の隣接リスト。接続の向きはレイアウト上は区別せず、無向グラフとして扱う。 */
function buildAdjacency(doc: ScapDocument, unitOf: Map<number, number>): Map<number, Set<number>> {
  const adjacency = new Map<number, Set<number>>();
  const link = (a: number, b: number) => {
    if (a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  for (const note of doc.notes) {
    const from = unitOf.get(note.id);
    if (from === undefined) continue;
    for (const target of [...note.connectedTo, ...note.pointsTo]) {
      const to = unitOf.get(target);
      if (to !== undefined) link(from, to);
    }
  }
  return adjacency;
}

/**
 * ノートIDごとの座標を決める。
 *
 * 接続グラフを連結成分に分け、成分ごとに最小IDのユニットを起点としたBFSを行い、
 * 探索の深さをX列、同じ深さの中での並び順をY方向に割り当てる。成分は縦に積む。
 * 探索順をユニットのインデックス順に固定しているため、同じ入力からは常に同じ座標が出る。
 */
export function layout(doc: ScapDocument): Map<number, Point> {
  const units = buildUnits(doc);
  const unitOf = new Map<number, number>();
  units.forEach((unit, index) => {
    for (const id of unit.ids) unitOf.set(id, index);
  });

  const adjacency = buildAdjacency(doc, unitOf);
  const heightOf = new Map(doc.notes.map((n) => [n.id, noteHeight(n.text)]));
  const positions = new Map<number, Point>();
  const visited = new Set<number>();
  let componentTop = 0;

  for (let seed = 0; seed < units.length; seed++) {
    if (visited.has(seed)) continue;

    // BFSで深さごとのユニットを集める。深さがそのまま列番号になる。
    const columns: number[][] = [];
    visited.add(seed);
    let frontier = [seed];
    while (frontier.length > 0) {
      columns.push(frontier);
      const next: number[] = [];
      for (const index of frontier) {
        const neighbors = [...(adjacency.get(index) ?? [])].sort((a, b) => a - b);
        for (const neighbor of neighbors) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
      frontier = next;
    }

    let componentHeight = 0;
    columns.forEach((column, depth) => {
      let y = componentTop;
      for (const index of column) {
        const unit = units[index]!;
        let inner = y;
        for (const id of unit.ids) {
          positions.set(id, { x: depth * COLUMN_WIDTH, y: inner });
          inner += heightOf.get(id) ?? NOTE_HEIGHT;
        }
        y += unitHeight(unit, heightOf);
      }
      componentHeight = Math.max(componentHeight, y - componentTop);
    });
    componentTop += componentHeight + COMPONENT_GAP;
  }

  return positions;
}
