export type ReasoningNodeKind =
  | 'indicator'
  | 'provider'
  | 'observation'
  | 'evidence_receipt'
  | 'detection_candidate'
  | 'rule_family'
  | 'attack_technique'
  | 'deployment_target'
  | 'agent_workflow'
  | 'edge_bastion';

export interface ReasoningNode {
  nodeId: string;
  kind: ReasoningNodeKind;
  label: string;
  sourceRefs: string[];
  confidence: number;
  provenanceHash: string;
}

export interface ReasoningEdge {
  edgeId: string;
  from: string;
  predicate: string;
  to: string;
  sourceRefs: string[];
  confidence: number;
}

export interface CyberGraphExport {
  schemaVersion: '0.1.0';
  graphExportId: string;
  generatedAt: string;
  sourceRefs: string[];
  nodes: ReasoningNode[];
  edges: ReasoningEdge[];
  executionPerformed: false;
}

export interface ReasoningHypothesis {
  hypothesisId: string;
  title: string;
  claim: string;
  confidence: number;
  evidenceNodeRefs: string[];
  evidenceEdgeRefs: string[];
  recommendedNextActions: string[];
}

export interface ReasoningContradiction {
  contradictionId: string;
  summary: string;
  severity: 'info' | 'low' | 'medium' | 'high';
  involvedRefs: string[];
}

export interface ScopeDReasoningPacket {
  schemaVersion: '0.1.0';
  packetId: string;
  sourceGraphRef: string;
  generatedAt: string;
  hypotheses: ReasoningHypothesis[];
  contradictions: ReasoningContradiction[];
  confidenceSummary: {
    meanNodeConfidence: number;
    meanEdgeConfidence: number;
    groundedEvidenceCount: number;
    detectionCandidateCount: number;
    attackTechniqueCount: number;
  };
  claimBoundary: 'all_claims_must_resolve_to_graph_or_receipt_refs';
  executionPerformed: false;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function byKind(graph: CyberGraphExport, kind: ReasoningNodeKind): ReasoningNode[] {
  return graph.nodes.filter((node) => node.kind === kind);
}

function edgesFrom(graph: CyberGraphExport, nodeId: string, predicate?: string): ReasoningEdge[] {
  return graph.edges.filter((edge) => edge.from === nodeId && (!predicate || edge.predicate === predicate));
}

function edgesTo(graph: CyberGraphExport, nodeId: string, predicate?: string): ReasoningEdge[] {
  return graph.edges.filter((edge) => edge.to === nodeId && (!predicate || edge.predicate === predicate));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'hypothesis';
}

function relatedEvidence(graph: CyberGraphExport, nodeId: string): { nodes: string[]; edges: string[] } {
  const adjacentEdges = graph.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId);
  const adjacentNodes = new Set<string>([nodeId]);
  for (const edge of adjacentEdges) {
    adjacentNodes.add(edge.from);
    adjacentNodes.add(edge.to);
  }
  return { nodes: Array.from(adjacentNodes), edges: adjacentEdges.map((edge) => edge.edgeId) };
}

function detectionHypotheses(graph: CyberGraphExport): ReasoningHypothesis[] {
  return byKind(graph, 'detection_candidate').map((candidate) => {
    const evidence = relatedEvidence(graph, candidate.nodeId);
    const attackEdges = edgesFrom(graph, candidate.nodeId, 'maps_to_attack');
    const attackSummary = attackEdges.map((edge) => edge.to.replace(/^attack:/, '')).join(', ') || 'unmapped technique';
    return {
      hypothesisId: `synapseiq-hypothesis:${slug(candidate.nodeId)}`,
      title: `Review defensive candidate ${candidate.label}`,
      claim: `SCOPE-D graph supports a reviewable defensive candidate mapped to ${attackSummary}.`,
      confidence: Number(Math.min(0.99, candidate.confidence * 0.7 + mean(attackEdges.map((edge) => edge.confidence)) * 0.3).toFixed(4)),
      evidenceNodeRefs: evidence.nodes,
      evidenceEdgeRefs: evidence.edges,
      recommendedNextActions: [
        'Review source receipts before analyst acceptance.',
        'Check required telemetry and false-positive profile.',
        'Route through operator approval before any downstream delivery.',
      ],
    };
  });
}

function edgeBastionHypotheses(graph: CyberGraphExport): ReasoningHypothesis[] {
  return byKind(graph, 'edge_bastion').map((bastion) => {
    const eligible = edgesTo(graph, bastion.nodeId, 'eligible_for_edge_bastion');
    const evidence = relatedEvidence(graph, bastion.nodeId);
    return {
      hypothesisId: `synapseiq-hypothesis:${slug(bastion.nodeId)}-assurance`,
      title: `${bastion.label} edge assurance posture`,
      claim: `${bastion.label} has ${eligible.length} graph-backed candidate delivery relationships that require policy review before use.`,
      confidence: Number(Math.min(0.99, bastion.confidence * 0.6 + mean(eligible.map((edge) => edge.confidence)) * 0.4).toFixed(4)),
      evidenceNodeRefs: evidence.nodes,
      evidenceEdgeRefs: evidence.edges,
      recommendedNextActions: [
        'Verify delivery envelope policy before staging edge work.',
        'Require operator approval and receipt validation.',
        'Expose readiness state to Noetica before field use.',
      ],
    };
  });
}

function findContradictions(graph: CyberGraphExport): ReasoningContradiction[] {
  const contradictions: ReasoningContradiction[] = [];
  const detections = byKind(graph, 'detection_candidate');
  for (const detection of detections) {
    const grounded = edgesFrom(graph, detection.nodeId, 'grounded_in').length + edgesTo(graph, detection.nodeId, 'generated_candidate').length;
    if (grounded === 0) {
      contradictions.push({
        contradictionId: `synapseiq-contradiction:${slug(detection.nodeId)}-ungrounded`,
        summary: `Detection candidate ${detection.nodeId} has no direct graph grounding edge.`,
        severity: 'high',
        involvedRefs: [detection.nodeId],
      });
    }
    if (detection.confidence < 0.5) {
      contradictions.push({
        contradictionId: `synapseiq-contradiction:${slug(detection.nodeId)}-low-confidence`,
        summary: `Detection candidate ${detection.nodeId} is below review confidence threshold.`,
        severity: 'medium',
        involvedRefs: [detection.nodeId],
      });
    }
  }
  const receipts = byKind(graph, 'evidence_receipt');
  const orphanReceipts = receipts.filter((receipt) => edgesTo(graph, receipt.nodeId, 'produced_receipt').length === 0 && edgesTo(graph, receipt.nodeId, 'grounded_in').length === 0);
  for (const receipt of orphanReceipts) {
    contradictions.push({
      contradictionId: `synapseiq-contradiction:${slug(receipt.nodeId)}-orphan-receipt`,
      summary: `Evidence receipt ${receipt.nodeId} is not connected to an observation or indicator path.`,
      severity: 'medium',
      involvedRefs: [receipt.nodeId],
    });
  }
  return contradictions;
}

export function buildScopeDReasoningPacket(graph: CyberGraphExport): ScopeDReasoningPacket {
  if (graph.executionPerformed !== false) {
    throw new Error('SynapseIQ refuses executing graph exports.');
  }
  if (graph.schemaVersion !== '0.1.0') {
    throw new Error(`Unsupported SCOPE-D graph schema ${graph.schemaVersion}.`);
  }
  const hypotheses = [...detectionHypotheses(graph), ...edgeBastionHypotheses(graph)];
  const contradictions = findContradictions(graph);
  return {
    schemaVersion: '0.1.0',
    packetId: `synapseiq-scope-d-packet:${graph.graphExportId.replace(/^cyber-graph-export:/, '')}`,
    sourceGraphRef: graph.graphExportId,
    generatedAt: new Date().toISOString(),
    hypotheses,
    contradictions,
    confidenceSummary: {
      meanNodeConfidence: mean(graph.nodes.map((node) => node.confidence)),
      meanEdgeConfidence: mean(graph.edges.map((edge) => edge.confidence)),
      groundedEvidenceCount: graph.edges.filter((edge) => edge.predicate === 'grounded_in' || edge.predicate === 'produced_receipt').length,
      detectionCandidateCount: byKind(graph, 'detection_candidate').length,
      attackTechniqueCount: byKind(graph, 'attack_technique').length,
    },
    claimBoundary: 'all_claims_must_resolve_to_graph_or_receipt_refs',
    executionPerformed: false,
  };
}
