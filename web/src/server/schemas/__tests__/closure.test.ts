import { describe, it, expect } from "vitest";
import { closurePredicateSchema, legacyClosurePredicateSchema } from "../closure";

describe("closurePredicateSchema — canonical (kind discriminant)", () => {
  it("parses metric_below_threshold", () => {
    const predicate = {
      kind: "metric_below_threshold",
      metric_spec: {
        metric: "defect_rate",
        product_id: "MC-200",
      },
      threshold: 0.01,
      window_days: 14,
      start_from: "dispatch_time",
    };
    const result = closurePredicateSchema.safeParse(predicate);
    expect(result.success).toBe(true);
  });

  it("parses count_stayed_at_value (covers no_defect_code_in_window pattern)", () => {
    const predicate = {
      kind: "count_stayed_at_value",
      filter_spec: {
        table: "defect",
        defect_code: "D-SOLDER",
        product_id: "MC-200",
      },
      value: 0,
      window_days: 30,
    };
    const result = closurePredicateSchema.safeParse(predicate);
    expect(result.success).toBe(true);
  });

  it("parses external_state_check", () => {
    const predicate = {
      kind: "external_state_check",
      target_system: "email_stub",
      target_ref: "INI-00042",
      expected_state: "sent",
    };
    const result = closurePredicateSchema.safeParse(predicate);
    expect(result.success).toBe(true);
  });

  it("parses composite AND of two predicates", () => {
    const predicate = {
      kind: "composite",
      op: "and",
      children: [
        {
          kind: "count_stayed_at_value",
          filter_spec: { table: "defect", defect_code: "D-SOLDER" },
          value: 0,
          window_days: 14,
        },
        {
          kind: "external_state_check",
          target_system: "supplier_portal_stub",
          target_ref: "INI-00001",
          expected_state: "sent",
        },
      ],
    };
    const result = closurePredicateSchema.safeParse(predicate);
    expect(result.success).toBe(true);
  });

  it("rejects unknown kind", () => {
    const result = closurePredicateSchema.safeParse({
      kind: "manual_confirmation",
      params: { confirmed_by: "user_001" },
    });
    // "manual_confirmation" is not a valid `kind` in the canonical schema
    expect(result.success).toBe(false);
  });

  it("rejects metric_below_threshold missing required threshold", () => {
    const result = closurePredicateSchema.safeParse({
      kind: "metric_below_threshold",
      metric_spec: { metric: "defect_rate" },
      window_days: 14,
      start_from: "dispatch_time",
      // missing threshold
    });
    expect(result.success).toBe(false);
  });

  it("rejects composite with invalid op", () => {
    const result = closurePredicateSchema.safeParse({
      kind: "composite",
      op: "xor",
      children: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("legacyClosurePredicateSchema (type discriminant)", () => {
  it("parses no_defect_code_in_window", () => {
    const result = legacyClosurePredicateSchema.safeParse({
      type: "no_defect_code_in_window",
      params: { defect_code: "D-SOLDER", days: 30 },
    });
    expect(result.success).toBe(true);
  });

  it("parses manual_confirmation", () => {
    const result = legacyClosurePredicateSchema.safeParse({
      type: "manual_confirmation",
      params: { confirmed_by: "user_engineer_01" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing defect_code on no_defect_code_in_window", () => {
    const result = legacyClosurePredicateSchema.safeParse({
      type: "no_defect_code_in_window",
      params: { days: 30 },
    });
    expect(result.success).toBe(false);
  });
});
