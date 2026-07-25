import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBuildInput, InvalidInputError } from "./build-input.js";

test("接続の指定が無いノートも受け付ける", () => {
  const doc = normalizeBuildInput({ notes: [{ id: 0, text: "A" }] });
  assert.deepEqual(doc.notes, [{ id: 0, text: "A", connectedTo: [], pointsTo: [] }]);
  assert.deepEqual(doc.stacks, []);
});

test("textを省略したノートは空文字になる", () => {
  const doc = normalizeBuildInput({ notes: [{ id: 0 }] });
  assert.equal(doc.notes[0]?.text, "");
});

test("自分自身への参照は落とす", () => {
  const doc = normalizeBuildInput({ notes: [{ id: 0, text: "A", connectedTo: [0], pointsTo: [0] }] });
  assert.deepEqual(doc.notes[0]?.connectedTo, []);
  assert.deepEqual(doc.notes[0]?.pointsTo, []);
});

test("重複した接続をまとめる", () => {
  const doc = normalizeBuildInput({
    notes: [
      { id: 0, text: "A", connectedTo: [1, 1], pointsTo: [1, 1] },
      { id: 1, text: "B", connectedTo: [0] },
    ],
  });
  assert.deepEqual(doc.notes[0]?.connectedTo, [1]);
  assert.deepEqual(doc.notes[0]?.pointsTo, [1]);
});

test("存在しないノートIDへの参照を拒否する", () => {
  assert.throws(
    () => normalizeBuildInput({ notes: [{ id: 0, text: "A", connectedTo: [99] }] }),
    InvalidInputError,
  );
  assert.throws(() => normalizeBuildInput({ notes: [{ id: 0, text: "A", pointsTo: [99] }] }), InvalidInputError);
  assert.throws(() => normalizeBuildInput({ notes: [{ id: 0, text: "A" }], stacks: [[0, 99]] }), InvalidInputError);
});

test("idの重複を拒否する", () => {
  assert.throws(
    () => normalizeBuildInput({ notes: [{ id: 0, text: "A" }, { id: 0, text: "B" }] }),
    InvalidInputError,
  );
});

test("1つのノートが複数のスタックに属する入力を拒否する", () => {
  assert.throws(
    () =>
      normalizeBuildInput({
        notes: [{ id: 0, text: "A" }, { id: 1, text: "B" }],
        stacks: [[0, 1], [0]],
      }),
    InvalidInputError,
  );
});

test("形の壊れた入力を拒否する", () => {
  assert.throws(() => normalizeBuildInput(null), InvalidInputError);
  assert.throws(() => normalizeBuildInput([]), InvalidInputError);
  assert.throws(() => normalizeBuildInput({ notes: [] }), InvalidInputError);
  assert.throws(() => normalizeBuildInput({ notes: [{ id: "0", text: "A" }] }), InvalidInputError);
  assert.throws(() => normalizeBuildInput({ notes: [{ id: 0, text: 1 }] }), InvalidInputError);
  assert.throws(() => normalizeBuildInput({ notes: [{ id: 0, connectedTo: "1" }] }), InvalidInputError);
  assert.throws(() => normalizeBuildInput({ notes: [{ id: 0 }], stacks: "0" }), InvalidInputError);
});
