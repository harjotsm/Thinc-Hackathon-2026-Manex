import { describe, it, expect } from "vitest";
import { signalRowSchema, signalInsertSchema, signalCaptureSchema } from "../signal";

const validFullRow = {
  signal_id: "SIG-00001",
  signal_type: "operator_report",
  source: "operator",
  source_system: "resolve_ui",
  source_ref: null,
  raw_text: "Lötpad abgebrochen an R33",
  lang: "de",
  embedding: null,
  attachments: null,
  triage: null,
  product_id: "MC-200",
  part_number: null,
  reported_part_number: null,
  batch_id: null,
  section_id: "SEC-01",
  defect_code: "D-SOLDER",
  test_key: null,
  order_id: "PO-00012",
  user_id: "user_042",
  market: "DE",
  shift: "early",
  severity: "high",
  severity_hint: 0.87,
  captured_ts: "2024-01-15T08:00:00Z",
  created_at: "2024-01-15T08:01:00Z",
  incident_id: null,
  created_by_user_id: "user_042",
  detector_rule: null,
  detector_evidence: null,
  raw_payload: { source: "test" },
  cluster_state: "attached",
  pending_until: null,
  idempotency_key: "hash-abc123",
  match_type: null,
  match_score: null,
  attach_reason: null,
  matched_incident_id: null,
  text_payload: null,
};

describe("signalRowSchema", () => {
  it("parses a valid full row", () => {
    const result = signalRowSchema.safeParse(validFullRow);
    expect(result.success).toBe(true);
  });

  it("accepts partial row (legacy fields optional)", () => {
    const minimal = {
      signal_id: "SIG-00002",
      signal_type: "engineer_report",
      captured_ts: "2024-01-15T10:00:00Z",
    };
    const result = signalRowSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("rejects invalid signal_type enum", () => {
    const bad = { ...validFullRow, signal_type: "unknown_type" };
    // signalRowSchema accepts z.string() fallback for signal_type, so test strict insert schema
    const insertBad = { ...validFullRow, source: "operator", raw_text: "x", severity: "high", captured_ts: "2024-01-15T08:00:00Z", idempotency_key: "k", signal_type: "not_a_real_type" };
    const result = signalInsertSchema.safeParse(insertBad);
    expect(result.success).toBe(false);
  });
});

describe("signalInsertSchema", () => {
  const validInsert = {
    signal_type: "operator_report" as const,
    source: "operator" as const,
    raw_text: "Defect on line 3",
    severity: "medium" as const,
    captured_ts: "2024-01-15T08:00:00Z",
    idempotency_key: "hash-xyz-001",
  };

  it("parses with required fields only", () => {
    const result = signalInsertSchema.safeParse(validInsert);
    expect(result.success).toBe(true);
  });

  it("rejects when idempotency_key is missing", () => {
    const { idempotency_key: _, ...noKey } = validInsert;
    const result = signalInsertSchema.safeParse(noKey);
    expect(result.success).toBe(false);
  });

  it("rejects when raw_text is missing", () => {
    const { raw_text: _, ...noText } = validInsert;
    const result = signalInsertSchema.safeParse(noText);
    expect(result.success).toBe(false);
  });

  it("accepts embedding as array of 1536 numbers", () => {
    const withEmbedding = {
      ...validInsert,
      embedding: Array.from({ length: 1536 }, () => 0.1),
    };
    const result = signalInsertSchema.safeParse(withEmbedding);
    expect(result.success).toBe(true);
  });

  it("rejects embedding with wrong length", () => {
    const withBadEmbedding = {
      ...validInsert,
      embedding: [0.1, 0.2, 0.3],
    };
    const result = signalInsertSchema.safeParse(withBadEmbedding);
    expect(result.success).toBe(false);
  });
});

describe("signalCaptureSchema (backward compat)", () => {
  it("parses legacy intake payload", () => {
    const legacy = {
      signal_type: "operator_report",
      source_system: "resolve_ui",
      text_payload: "Some problem",
      severity_hint: 0.5,
    };
    const result = signalCaptureSchema.safeParse(legacy);
    expect(result.success).toBe(true);
  });

  it("parses extended payload with new optional fields", () => {
    const extended = {
      signal_type: "detector_anomaly",
      source_system: "spc_detector",
      detector_rule: "SPC_3SIGMA",
      idempotency_key: "det-001",
    };
    const result = signalCaptureSchema.safeParse(extended);
    expect(result.success).toBe(true);
  });
});
