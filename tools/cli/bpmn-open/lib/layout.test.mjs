import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureLayout, hasLayout } from './layout.mjs';

const NO_DI = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="http://example.com">
  <bpmn:process id="P" isExecutable="false">
    <bpmn:startEvent id="S" />
    <bpmn:task id="T" name="作業" />
    <bpmn:endEvent id="E" />
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

test('incoming/outgoing の無い XML にも、横一列の座標と矢印を付ける', async () => {
  const { xml, laidOut } = await ensureLayout(NO_DI);
  assert.equal(laidOut, true);
  assert.ok(hasLayout(xml));
  assert.equal((xml.match(/<bpmndi:BPMNEdge /g) || []).length, 2);
  const xs = [...xml.matchAll(/<dc:Bounds x="(\d+)"/g)].map((m) => Number(m[1])).slice(0, 3);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2], `左から右へ並ぶ: ${xs}`);
});

test('座標がある XML はそのまま返す', async () => {
  const { xml: laid } = await ensureLayout(NO_DI);
  const again = await ensureLayout(laid);
  assert.equal(again.laidOut, false);
  assert.equal(again.xml, laid);
});
