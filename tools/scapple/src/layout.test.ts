import { test } from "node:test";
import assert from "node:assert/strict";
import { layout } from "./layout.js";
import { normalizeBuildInput } from "./build-input.js";

function positionsOf(raw: unknown) {
  return layout(normalizeBuildInput(raw));
}

test("接続されたノートを深さの順に別の列へ置く", () => {
  const positions = positionsOf({
    notes: [
      { id: 0, text: "起点", connectedTo: [1] },
      { id: 1, text: "隣", connectedTo: [2] },
      { id: 2, text: "その先" },
    ],
  });
  assert.equal(positions.get(0)?.x, 0);
  assert.equal(positions.get(1)?.x, 200);
  assert.equal(positions.get(2)?.x, 400);
});

test("同じ深さのノートは同じ列に縦に並ぶ", () => {
  const positions = positionsOf({
    notes: [
      { id: 0, text: "親", connectedTo: [1, 2] },
      { id: 1, text: "子1" },
      { id: 2, text: "子2" },
    ],
  });
  assert.equal(positions.get(1)?.x, positions.get(2)?.x);
  assert.notEqual(positions.get(1)?.y, positions.get(2)?.y);
});

test("スタックのノートを同じ列に連続した縦位置で並べる", () => {
  const positions = positionsOf({
    notes: [
      { id: 0, text: "手順1" },
      { id: 1, text: "手順2" },
      { id: 2, text: "手順3" },
    ],
    stacks: [[0, 1, 2]],
  });
  const [a, b, c] = [positions.get(0)!, positions.get(1)!, positions.get(2)!];
  assert.equal(a.x, b.x);
  assert.equal(b.x, c.x);
  assert.equal(b.y - a.y, 32);
  assert.equal(c.y - b.y, 32);
});

test("スタック内の複数行ノートの分だけ次のノートを下げる", () => {
  const positions = positionsOf({
    notes: [
      { id: 0, text: "1行目\n2行目" },
      { id: 1, text: "次" },
    ],
    stacks: [[0, 1]],
  });
  assert.equal(positions.get(1)!.y - positions.get(0)!.y, 48);
});

test("繋がっていないノート群は縦に離して別の島にする", () => {
  const positions = positionsOf({
    notes: [
      { id: 0, text: "島A", connectedTo: [1] },
      { id: 1, text: "島Aの隣" },
      { id: 2, text: "島B" },
    ],
  });
  // 島Bは起点なので同じ列に来るが、島Aと重ならない位置へ送られる。
  assert.equal(positions.get(2)?.x, 0);
  assert.ok(positions.get(2)!.y > positions.get(0)!.y);
});

test("全ノートに座標が付く", () => {
  const positions = positionsOf({
    notes: [
      { id: 0, text: "A", pointsTo: [7] },
      { id: 7, text: "B" },
      { id: 9, text: "孤立" },
    ],
  });
  assert.deepEqual([...positions.keys()].sort((a, b) => a - b), [0, 7, 9]);
});

test("有向の接続も列の分割に使う", () => {
  const positions = positionsOf({
    notes: [
      { id: 0, text: "原因", pointsTo: [1] },
      { id: 1, text: "結果" },
    ],
  });
  assert.equal(positions.get(1)?.x, 200);
});
