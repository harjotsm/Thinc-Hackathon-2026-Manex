import type {
  ContributionRow,
  HypothesisView,
  IncidentRow,
  ReportInitiative,
  SignalRow,
} from "@/server/incident/loaders";

export const sampleIncident: IncidentRow = {
  incident_id: "INC-SEED-SUPPLIER-001",
  title: "Cold solder failures on PM-00008",
  summary: "Field returns linked to supplier batch SB-00007.",
  severity: "high",
  primary_product_id: "PM-00008",
  status: "open",
};

export const sampleSignals: SignalRow[] = [
  {
    signal_id: "SIG-408",
    signal_type: "warranty_claim",
    source_system: "Warranty",
    captured_ts: "2026-04-19T03:00:00Z",
    text_payload: "Customer reports intermittent shutdown on PM-00008 unit.",
  },
  {
    signal_id: "SIG-411",
    signal_type: "incoming_inspection",
    source_system: "Inbound-Inspection",
    captured_ts: "2026-04-19T02:00:00Z",
    text_payload: "Batch SB-00007 caps measured ESR mean 0.28Ω, exceeds 0.22Ω limit.",
  },
  {
    signal_id: "SIG-412",
    signal_type: "spc_drift",
    source_system: "SPC-Drift",
    captured_ts: "2026-04-19T01:00:00Z",
    text_payload: "Reflow profile drift at Stn-04 — peak 6°C above target.",
  },
];

export const sampleHypotheses: HypothesisView[] = [
  {
    id: "HYP-1",
    rank: 1,
    title: "Supplier batch SB-00007 ESR out of spec",
    oneLiner: "Supplier batch SB-00007 R33 capacitors with elevated ESR mean 0.28Ω vs spec 0.22Ω",
    confidence: 0.82,
    supportingEvidence: ["SIG-408", "SIG-411", "SIG-412"],
    conflictingEvidence: [],
    archetypeHint: "Supplier",
    isPrimary: true,
  },
  {
    id: "HYP-2",
    rank: 2,
    title: "Reflow drift at Linie 1",
    oneLiner: "Reflow drift at Linie 1 station Stn-04 increasing solder defects since W49",
    confidence: 0.45,
    supportingEvidence: ["SIG-412"],
    conflictingEvidence: [],
    archetypeHint: "Process",
    isPrimary: false,
  },
  {
    id: "HYP-3",
    rank: 3,
    title: "MC-200 thermal margin",
    oneLiner: "MC-200 design thermal margin insufficient for sustained load",
    confidence: 0.35,
    supportingEvidence: [],
    conflictingEvidence: [],
    archetypeHint: "Design",
    isPrimary: false,
  },
];

export const sampleInitiatives: ReportInitiative[] = [
  {
    title: "Quarantine SB-00007 batch and insert 100% ESR inspection at Stn-04",
    domain: "production",
    target_system: "MES",
    owner_hint: "Plant Quality Lead, Werk München",
    rationale: "Containment to prevent further at-risk units reaching customers.",
    confidence: 0.88,
    evidence: ["TC-001", "TC-002"],
    closure_predicate: { type: "no_defect_code_in_window", params: { defect_code: "PM_SHUTDOWN", days: 30 } },
  },
  {
    title: "Issue 8D to ElektroParts for batch traceability review",
    domain: "supplier",
    target_system: "SRM",
    owner_hint: "Supplier Quality, J. Keller",
    rationale: "Supplier accountability + corrective action on inspection process.",
    confidence: 0.82,
    evidence: ["TC-003"],
    closure_predicate: { type: "manual_confirmation", params: {} },
  },
];

export const sampleContributions: ContributionRow[] = [
  {
    contribution_id: "CTB-001",
    domain: "supplier_quality",
    content: "Confirmed batch SB-00007 received without proper ESR sampling.",
    structured_payload: null,
    source: "user",
    status: "available",
    weight: 1.0,
    created_ts: "2026-04-19T04:00:00Z",
  },
  {
    contribution_id: "CTB-002",
    domain: "process_planner",
    content: "Stn-04 reflow profile last calibrated 2026-03-10.",
    structured_payload: null,
    source: "agent",
    status: "available",
    weight: 1.0,
    created_ts: "2026-04-19T04:30:00Z",
  },
  {
    contribution_id: "CTB-003",
    domain: "rnd",
    content: "R33 footprint margin within spec for nominal batches; not a design defect.",
    structured_payload: null,
    source: "agent",
    status: "available",
    weight: 1.0,
    created_ts: "2026-04-19T04:45:00Z",
  },
  {
    contribution_id: "CTB-004",
    domain: "finance",
    content: "Estimated exposure €38k over 12 weeks if uncontained.",
    structured_payload: null,
    source: "agent",
    status: "available",
    weight: 1.0,
    created_ts: "2026-04-19T04:50:00Z",
  },
];
