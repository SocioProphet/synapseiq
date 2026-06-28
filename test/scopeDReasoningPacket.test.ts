import assert from 'node:assert/strict';
import { buildScopeDReasoningPacket, CyberGraphExport } from '../src/scopeDReasoningPacket';

const graph: CyberGraphExport = {
  schemaVersion: '0.1.0',
  graphExportId: 'cyber-graph-export:demo',
  generatedAt: '2026-06-28T00:00:00.000Z',
  sourceRefs: ['scope-d://graph/demo'],
  executionPerformed: false,
  nodes: [
    {
      nodeId: 'indicator:sha256-demo',
      kind: 'indicator',
      label: 'sha256:aaaaaaaa',
      sourceRefs: ['scope-d://enrichment'],
      confidence: 0.8,
      provenanceHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    {
      nodeId: 'intelligence-receipt:virustotal-demo',
      kind: 'evidence_receipt',
      label: 'virustotal',
      sourceRefs: ['scope-d://enrichment'],
      confidence: 0.95,
      provenanceHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    {
      nodeId: 'intelligence-observation:malware-demo',
      kind: 'observation',
      label: 'malware_reputation',
      sourceRefs: ['intelligence-receipt:virustotal-demo'],
      confidence: 0.86,
      provenanceHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    },
    {
      nodeId: 'detection-candidate:arsenal-demo',
      kind: 'detection_candidate',
      label: 'SCOPE-D malware reputation via VirusTotal',
      sourceRefs: ['scope-d://detections'],
      confidence: 0.76,
      provenanceHash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    },
    {
      nodeId: 'attack:ATT&CK:T1204',
      kind: 'attack_technique',
      label: 'ATT&CK:T1204',
      sourceRefs: ['detection-candidate:arsenal-demo'],
      confidence: 0.75,
      provenanceHash: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    },
    {
      nodeId: 'edge-bastion:cloudshell-fog',
      kind: 'edge_bastion',
      label: 'CloudShell Fog',
      sourceRefs: ['scope-d://detections'],
      confidence: 0.8,
      provenanceHash: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
  ],
  edges: [
    {
      edgeId: 'cyber-graph-runtime-edge:indicator-receipt',
      from: 'indicator:sha256-demo',
      predicate: 'produced_receipt',
      to: 'intelligence-receipt:virustotal-demo',
      sourceRefs: ['intelligence-receipt:virustotal-demo'],
      confidence: 0.9,
    },
    {
      edgeId: 'cyber-graph-runtime-edge:indicator-observation',
      from: 'indicator:sha256-demo',
      predicate: 'produced_observation',
      to: 'intelligence-observation:malware-demo',
      sourceRefs: ['intelligence-receipt:virustotal-demo'],
      confidence: 0.86,
    },
    {
      edgeId: 'cyber-graph-runtime-edge:observation-candidate',
      from: 'intelligence-observation:malware-demo',
      predicate: 'generated_candidate',
      to: 'detection-candidate:arsenal-demo',
      sourceRefs: ['intelligence-receipt:virustotal-demo'],
      confidence: 0.76,
    },
    {
      edgeId: 'cyber-graph-runtime-edge:candidate-attack',
      from: 'detection-candidate:arsenal-demo',
      predicate: 'maps_to_attack',
      to: 'attack:ATT&CK:T1204',
      sourceRefs: ['detection-candidate:arsenal-demo'],
      confidence: 0.75,
    },
    {
      edgeId: 'cyber-graph-runtime-edge:candidate-cloudshell',
      from: 'detection-candidate:arsenal-demo',
      predicate: 'eligible_for_edge_bastion',
      to: 'edge-bastion:cloudshell-fog',
      sourceRefs: ['detection-candidate:arsenal-demo'],
      confidence: 0.8,
    },
  ],
};

const packet = buildScopeDReasoningPacket(graph);
assert.equal(packet.schemaVersion, '0.1.0');
assert.equal(packet.executionPerformed, false);
assert.equal(packet.claimBoundary, 'all_claims_must_resolve_to_graph_or_receipt_refs');
assert.equal(packet.confidenceSummary.detectionCandidateCount, 1);
assert.equal(packet.confidenceSummary.attackTechniqueCount, 1);
assert.ok(packet.confidenceSummary.groundedEvidenceCount >= 1);
assert.ok(packet.hypotheses.length >= 2);
assert.ok(packet.hypotheses.some((hypothesis) => hypothesis.claim.includes('ATT&CK:T1204')));
assert.ok(packet.hypotheses.some((hypothesis) => hypothesis.claim.includes('CloudShell Fog')));
assert.equal(packet.contradictions.length, 0);

const ungroundedGraph: CyberGraphExport = {
  ...graph,
  nodes: [
    ...graph.nodes,
    {
      nodeId: 'detection-candidate:ungrounded-demo',
      kind: 'detection_candidate',
      label: 'Ungrounded candidate',
      sourceRefs: ['scope-d://detections'],
      confidence: 0.4,
      provenanceHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    },
  ],
};
const contradictionPacket = buildScopeDReasoningPacket(ungroundedGraph);
assert.ok(contradictionPacket.contradictions.some((contradiction) => contradiction.contradictionId.includes('ungrounded')));
assert.ok(contradictionPacket.contradictions.some((contradiction) => contradiction.contradictionId.includes('low-confidence')));

assert.throws(() => buildScopeDReasoningPacket({ ...graph, executionPerformed: true as false }), /refuses executing/);

console.log('SCOPE-D reasoning packet tests passed.');
