// 図の座標（bpmndi）が無い BPMN に、bpmn-auto-layout で座標を付ける。
// bpmn-auto-layout は各ノードの <bpmn:incoming>/<bpmn:outgoing> をたどって配置するため、
// それが書かれていない XML では、sequenceFlow の sourceRef/targetRef から先に補う。
// レーンとプールの座標は bpmn-auto-layout が出力しないので、それらは描かれない。
import { BpmnModdle } from 'bpmn-moddle';
import { layoutProcess } from 'bpmn-auto-layout';

export function hasLayout(xml) {
  return /BPMNDiagram\b/.test(xml);
}

export async function ensureLayout(xml) {
  if (hasLayout(xml)) return { xml, laidOut: false };

  const moddle = new BpmnModdle();
  const { rootElement: definitions } = await moddle.fromXML(xml);

  const linkFlows = (container) => {
    for (const el of container.flowElements || []) {
      if (el.$type === 'bpmn:SequenceFlow') {
        const { sourceRef: src, targetRef: tgt } = el;
        if (src && !(src.outgoing ||= []).includes(el)) src.outgoing.push(el);
        if (tgt && !(tgt.incoming ||= []).includes(el)) tgt.incoming.push(el);
      }
      if (el.flowElements) linkFlows(el); // サブプロセスの中も補う
    }
  };
  for (const root of definitions.rootElements || []) {
    if (root.$type === 'bpmn:Process') linkFlows(root);
  }

  const { xml: linked } = await moddle.toXML(definitions, { format: true });
  return { xml: await layoutProcess(linked), laidOut: true };
}
