import { describe, it, expect } from "vitest";
import {
  sessionRowSchema,
  sessionPhaseEnum,
  sessionStatusEnum,
  failureReasonEnum,
  sessionTurnRowSchema,
  sessionEventRowSchema,
  sessionEventInsertSchema,
} from "../session";

describe("sessionPhaseEnum", () => {
  const validPhases = ["classify", "investigate", "compose", "propose", "complete", "failed"];

  it.each(validPhases)("accepts phase '%s'", (phase) => {
    const result = sessionPhaseEnum.safeParse(phase);
    expect(result.success).toBe(true);
  });

  it("rejects unknown phase", () => {
    const result = sessionPhaseEnum.safeParse("analyze");
    expect(result.success).toBe(false);
  });
});

describe("sessionStatusEnum", () => {
  const validStatuses = ["running", "succeeded", "failed", "stalled", "cancelled"];

  it.each(validStatuses)("accepts status '%s'", (status) => {
    const result = sessionStatusEnum.safeParse(status);
    expect(result.success).toBe(true);
  });

  it("rejects unknown status", () => {
    const result = sessionStatusEnum.safeParse("pending");
    expect(result.success).toBe(false);
  });
});

describe("failureReasonEnum", () => {
  const validReasons = [
    "max_turns",
    "stall_loop",
    "evidence_cite_unfixable",
    "model_refusal",
    "context_overflow",
    "api_error_exhausted",
    "tool_errors_exhausted",
    "aborted_by_user",
    "orchestrator_crash",
    "semantic_validator_failed",
  ];

  it.each(validReasons)("accepts reason '%s'", (reason) => {
    const result = failureReasonEnum.safeParse(reason);
    expect(result.success).toBe(true);
  });

  it("rejects unknown reason", () => {
    const result = failureReasonEnum.safeParse("timeout");
    expect(result.success).toBe(false);
  });
});

describe("sessionRowSchema", () => {
  const validSession = {
    id: "SES-00001",
    incident_id: "INC-00001",
    phase: "investigate",
    status: "running",
    started_at: "2024-01-15T08:00:00Z",
    ended_at: null,
    total_tokens_in: 1200,
    total_tokens_out: 850,
    total_cost_usd: 0.0042,
    failure_reason: null,
    created_by_user_id: "user_001",
  };

  it("parses a valid session row", () => {
    const result = sessionRowSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("rejects when id is missing", () => {
    const { id: _, ...noId } = validSession;
    const result = sessionRowSchema.safeParse(noId);
    expect(result.success).toBe(false);
  });

  it("rejects when incident_id is missing", () => {
    const { incident_id: _, ...noIncident } = validSession;
    const result = sessionRowSchema.safeParse(noIncident);
    expect(result.success).toBe(false);
  });

  it("accepts failure_reason from enum", () => {
    const withReason = { ...validSession, failure_reason: "max_turns", status: "failed" };
    const result = sessionRowSchema.safeParse(withReason);
    expect(result.success).toBe(true);
  });

  it("rejects invalid failure_reason", () => {
    const withBadReason = { ...validSession, failure_reason: "unknown_failure" };
    const result = sessionRowSchema.safeParse(withBadReason);
    expect(result.success).toBe(false);
  });
});

describe("sessionTurnRowSchema", () => {
  it("parses assistant turn", () => {
    const turn = {
      id: "ST-abc123",
      session_id: "SES-00001",
      turn_index: 0,
      phase: "investigate",
      role: "assistant",
      model: "sonnet-4-6",
      content_text: "Analyzing the defect pattern...",
      tool_call: null,
      tokens_in: 500,
      tokens_out: 120,
      duration_ms: 1800,
      created_at: "2024-01-15T08:01:00Z",
    };
    const result = sessionTurnRowSchema.safeParse(turn);
    expect(result.success).toBe(true);
  });

  it("parses tool turn with tool_call", () => {
    const turn = {
      id: "ST-def456",
      session_id: "SES-00001",
      turn_index: 1,
      phase: "investigate",
      role: "tool",
      model: null,
      content_text: null,
      tool_call: {
        tool_call_id: "tc-001",
        name: "query_defect_history",
        input: { product_id: "MC-200" },
        output_ref: null,
        status: "success",
        latency_ms: 340,
        result_hash: "sha256:abc",
      },
      tokens_in: null,
      tokens_out: null,
      duration_ms: 340,
      created_at: "2024-01-15T08:01:02Z",
    };
    const result = sessionTurnRowSchema.safeParse(turn);
    expect(result.success).toBe(true);
  });
});

describe("sessionEventInsertSchema", () => {
  it("parses valid event insert", () => {
    const insert = {
      session_id: "SES-00001",
      event_type: "tool_call_start",
      payload: { tool: "query_defect_history", input: {} },
    };
    const result = sessionEventInsertSchema.safeParse(insert);
    expect(result.success).toBe(true);
  });

  it("rejects missing session_id", () => {
    const result = sessionEventInsertSchema.safeParse({ event_type: "turn_complete", payload: {} });
    expect(result.success).toBe(false);
  });
});
