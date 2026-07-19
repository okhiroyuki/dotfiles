import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScapXml } from "./parser.js";

function wrap(notesXml: string, stacksXml = ""): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ScappleDocument Version="1.2" ID="00000000-0000-0000-0000-000000000000">
  <Notes>
${notesXml}
  </Notes>
  <Stacks>
${stacksXml}
  </Stacks>
</ScappleDocument>`;
}

test("Stringノートのテキストと無向・有向の接続を区別してパースする", () => {
  const xml = wrap(`
    <Note ID="0" Position="0,0" Width="10.0">
      <String>親</String>
      <ConnectedNoteIDs>1</ConnectedNoteIDs>
      <PointsToNoteIDs>2</PointsToNoteIDs>
    </Note>
    <Note ID="1" Position="0,0" Width="10.0"><String>無向の相手</String></Note>
    <Note ID="2" Position="0,0" Width="10.0"><String>有向の相手</String></Note>
  `);
  const doc = parseScapXml(xml);
  const note0 = doc.notes.find((n) => n.id === 0);
  assert.equal(note0?.text, "親");
  assert.deepEqual(note0?.connectedTo, [1]);
  assert.deepEqual(note0?.pointsTo, [2]);
});

test("スタックをID配列として順序どおりパースする", () => {
  const xml = wrap(
    `
    <Note ID="0" Position="0,0" Width="10.0"><String>手順1</String></Note>
    <Note ID="1" Position="0,0" Width="10.0"><String>手順2</String></Note>
  `,
    "    <Stack>0-1</Stack>",
  );
  const doc = parseScapXml(xml);
  assert.deepEqual(doc.stacks, [[0, 1]]);
});

test("画像ノート(String要素なし)はファイル名をプレースホルダとして拾う", () => {
  const xml = wrap(`
    <Note ID="9" Position="0,0" Width="10.0">
      <ImageData Type="jpg" Name="learning_pyramid-1.jpg">AAAA</ImageData>
    </Note>
  `);
  const doc = parseScapXml(xml);
  const note = doc.notes.find((n) => n.id === 9);
  assert.equal(note?.text, "[image: learning_pyramid-1.jpg]");
});

test("画像ノートのbase64本体データはtextに含まれない", () => {
  const xml = wrap(`
    <Note ID="9" Position="0,0" Width="10.0">
      <ImageData Type="jpg" Name="x.jpg">AAAABBBBCCCC</ImageData>
    </Note>
  `);
  const doc = parseScapXml(xml);
  const note = doc.notes.find((n) => n.id === 9);
  assert.doesNotMatch(note?.text ?? "", /AAAABBBBCCCC/);
});

test("StringもImageDataも無いノートは空文字になる", () => {
  const xml = wrap(`
    <Note ID="0" Position="0,0" Width="10.0"></Note>
  `);
  const doc = parseScapXml(xml);
  assert.equal(doc.notes[0]?.text, "");
});
