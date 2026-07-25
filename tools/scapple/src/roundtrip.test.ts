import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScapXml } from "./parser.js";
import { buildScapXml } from "./builder.js";

/**
 * Scapple本体が書き出したファイルと同じ構造のXML。
 * 座標・スタイル・背景図形・画像ノートなど、CLIが読み飛ばす要素を一通り含めてある。
 */
const REAL_WORLD_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ScappleDocument Version="1.2" ID="38510761-F225-469E-9006-82AD22896599">
  <Notes>
    <Note ID="0" FontSize="12.0" Position="289.6,382.7" Width="40.0">
      <Appearance>
        <Alignment>Left</Alignment>
      </Appearance>
      <String>類推</String>
      <ConnectedNoteIDs>1-2, 5</ConnectedNoteIDs>
    </Note>
    <Note ID="1" FontSize="12.0" Position="688.2,57.5" Width="52.0">
      <Appearance>
        <Alignment>Left</Alignment>
      </Appearance>
      <String>抽象化</String>
      <ConnectedNoteIDs>0</ConnectedNoteIDs>
    </Note>
    <Note ID="2" FontSize="12.0" Position="323.6,151.5" Width="40.0">
      <Appearance>
        <Alignment>Left</Alignment>
      </Appearance>
      <String>具体</String>
      <ConnectedNoteIDs>0, 3</ConnectedNoteIDs>
      <PointsToNoteIDs>3</PointsToNoteIDs>
    </Note>
    <Note ID="3" FontSize="12.0" Position="555.6,155.7" Width="64.0">
      <Appearance>
        <Alignment>Left</Alignment>
      </Appearance>
      <String>準抽象化</String>
      <ConnectedNoteIDs>2</ConnectedNoteIDs>
    </Note>
    <Note ID="4" Position="600,300" Width="10.0" Height="10.0">
      <ImageData Type="jpg" Name="latte-art.jpg">/9k=</ImageData>
    </Note>
    <Note ID="5" FontSize="12.0" Position="296.5,236.4" Width="88.0">
      <Appearance>
        <Alignment>Left</Alignment>
      </Appearance>
      <String>要素数が多い</String>
      <ConnectedNoteIDs>0</ConnectedNoteIDs>
    </Note>
    <Note ID="6" FontSize="12.0" Position="0,0" Width="100.0">
      <String>孤立したノート</String>
    </Note>
  </Notes>
  <BackgroundShapes>
    <Shape ID="32" Position="641.6,428.6" Width="168.0" Sticky="no" Height="186.0">
      <Appearance>
        <Border Weight="1"/>
      </Appearance>
    </Shape>
  </BackgroundShapes>
  <Stacks>
    <Stack>1,3</Stack>
  </Stacks>
  <AutoFit>0-3, 5-6</AutoFit>
  <NoteStyles>
    <Style Name="Title Text" ID="9311F7ED-D701-4B5A-8AF5-1B8170112A52" AffectFontStyle="Yes">
      <FontSize>28.0</FontSize>
      <IsBold>Yes</IsBold>
    </Style>
  </NoteStyles>
  <UISettings>
    <BackgroundColor>0.999763 0.988395 0.949915</BackgroundColor>
    <DefaultFont>Helvetica</DefaultFont>
    <NoteXPadding>8.0</NoteXPadding>
  </UISettings>
  <PrintSettings PaperSize="595.0,842.0" LeftMargin="72.0" Orientation="Portrait"/>
</ScappleDocument>`;

test("Scappleが書き出した形のXMLを読み書きしても構造が変わらない", () => {
  const first = parseScapXml(REAL_WORLD_XML);
  const second = parseScapXml(buildScapXml(first));
  assert.deepEqual(second, first);
});

test("2回書き出しても同じXMLになる", () => {
  const options = { documentId: "00000000-0000-0000-0000-000000000000" };
  const once = buildScapXml(parseScapXml(REAL_WORLD_XML), options);
  const twice = buildScapXml(parseScapXml(once), options);
  assert.equal(twice, once);
});

test("矢印付きの線が往復しても矢印のまま残る", () => {
  const doc = parseScapXml(buildScapXml(parseScapXml(REAL_WORLD_XML)));
  const note = doc.notes.find((n) => n.id === 2);
  assert.deepEqual(note?.pointsTo, [3]);
  // 有向の線が無向の関連としても数えられていないこと。
  assert.ok(!note?.connectedTo.includes(3));
});

test("画像ノートと孤立ノートも書き出しの対象から漏れない", () => {
  const doc = parseScapXml(buildScapXml(parseScapXml(REAL_WORLD_XML)));
  assert.equal(doc.notes.find((n) => n.id === 4)?.text, "[image: latte-art.jpg]");
  assert.equal(doc.notes.find((n) => n.id === 6)?.text, "孤立したノート");
});

test("スタックが往復しても順序ごと保たれる", () => {
  const doc = parseScapXml(buildScapXml(parseScapXml(REAL_WORLD_XML)));
  assert.deepEqual(doc.stacks, [[1, 3]]);
});
