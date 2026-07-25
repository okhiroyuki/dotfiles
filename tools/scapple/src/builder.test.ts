import { test } from "node:test";
import assert from "node:assert/strict";
import { buildScapXml } from "./builder.js";
import { normalizeBuildInput } from "./build-input.js";
import { parseScapXml } from "./parser.js";

const FIXED_ID = "00000000-0000-0000-0000-000000000000";

function build(raw: unknown): string {
  return buildScapXml(normalizeBuildInput(raw), { documentId: FIXED_ID });
}

test("生成したXMLをパースし直すと元の構造に戻る", () => {
  const input = {
    notes: [
      { id: 0, text: "豆を挽く" },
      { id: 1, text: "お湯を注ぐ" },
      { id: 2, text: "味", connectedTo: [3] },
      { id: 3, text: "焙煎度", pointsTo: [2] },
    ],
    stacks: [[0, 1]],
  };
  const doc = parseScapXml(build(input));

  assert.deepEqual(
    doc.notes.map((n) => n.text),
    ["豆を挽く", "お湯を注ぐ", "味", "焙煎度"],
  );
  assert.deepEqual(doc.notes.find((n) => n.id === 3)?.pointsTo, [2]);
  assert.deepEqual(doc.stacks, [[0, 1]]);
});

test("片側だけに書かれた無向の接続を両側へ対称化する", () => {
  const doc = parseScapXml(
    build({
      notes: [
        { id: 0, text: "A", connectedTo: [1] },
        { id: 1, text: "B" },
      ],
    }),
  );
  assert.deepEqual(doc.notes.find((n) => n.id === 0)?.connectedTo, [1]);
  assert.deepEqual(doc.notes.find((n) => n.id === 1)?.connectedTo, [0]);
});

test("有向の接続は逆向きには複製しない", () => {
  const doc = parseScapXml(
    build({
      notes: [
        { id: 0, text: "原因", pointsTo: [1] },
        { id: 1, text: "結果" },
      ],
    }),
  );
  assert.deepEqual(doc.notes.find((n) => n.id === 1)?.pointsTo, []);
  assert.deepEqual(doc.notes.find((n) => n.id === 1)?.connectedTo, []);
});

test("矢印の相手を線としても両端のConnectedNoteIDsに登録する", () => {
  // Scappleは線が引かれていないノート間に矢尻を描かないため、これが無いと矢印が消える。
  const xml = build({
    notes: [
      { id: 0, text: "原因", pointsTo: [1] },
      { id: 1, text: "結果" },
    ],
  });
  assert.match(xml, /<String>原因<\/String>\n\s*<ConnectedNoteIDs>1<\/ConnectedNoteIDs>/);
  assert.match(xml, /<String>結果<\/String>\n\s*<ConnectedNoteIDs>0<\/ConnectedNoteIDs>/);
});

test("XMLの特殊文字を含むテキストをエスケープして往復できる", () => {
  const text = '<a href="x"> & </a>';
  const doc = parseScapXml(build({ notes: [{ id: 0, text }] }));
  assert.equal(doc.notes[0]?.text, text);
});

test("全ノートをAutoFitに登録する（Scappleと同じ空白なしの区切り）", () => {
  const xml = build({ notes: [{ id: 0, text: "A" }, { id: 1, text: "B" }, { id: 5, text: "C" }] });
  assert.match(xml, /<AutoFit>0-1,5<\/AutoFit>/);
});

test("PointsToNoteIDsは連続IDでも範囲表記にせず空白なしで列挙する", () => {
  const xml = build({
    notes: [
      { id: 0, text: "起点", pointsTo: [1, 2, 3] },
      { id: 1, text: "A" },
      { id: 2, text: "B" },
      { id: 3, text: "C" },
    ],
  });
  assert.match(xml, /<PointsToNoteIDs>1,2,3<\/PointsToNoteIDs>/);
});

test("ConnectedNoteIDsはScappleと同じ空白付き・範囲表記で書く", () => {
  const xml = build({
    notes: [
      { id: 0, text: "起点", connectedTo: [1, 2, 3, 9] },
      { id: 1, text: "A" },
      { id: 2, text: "B" },
      { id: 3, text: "C" },
      { id: 9, text: "D" },
    ],
  });
  assert.match(xml, /<ConnectedNoteIDs>1-3, 9<\/ConnectedNoteIDs>/);
});

test("スタックが無いときはStacks要素を出力しない", () => {
  assert.doesNotMatch(build({ notes: [{ id: 0, text: "A" }] }), /<Stacks>/);
});

test("スタックの並び順を昇順に潰さずそのまま保つ", () => {
  const xml = build({
    notes: [
      { id: 0, text: "A" },
      { id: 1, text: "B" },
      { id: 2, text: "C" },
    ],
    stacks: [[2, 0, 1]],
  });
  assert.match(xml, /<Stack>2,0,1<\/Stack>/);
});

test("同じ入力からは常に同じXMLが出る", () => {
  const input = {
    notes: [
      { id: 0, text: "A", connectedTo: [1, 2] },
      { id: 1, text: "B" },
      { id: 2, text: "C", pointsTo: [1] },
    ],
    stacks: [[1, 2]],
  };
  assert.equal(build(input), build(input));
});

test("実ファイルと同じ属性構成のNote要素を書く", () => {
  const xml = build({ notes: [{ id: 0, text: "A" }] });
  assert.match(xml, /<Note ID="0" FontSize="12.0" Position="0\.0,0\.0" Width="100\.0">/);
});
