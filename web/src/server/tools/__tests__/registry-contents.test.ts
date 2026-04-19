/**
 * registry-contents.test.ts
 *
 * Smoke-tests that _register.ts wires up all 24 tools correctly.
 * The registry is a module-level singleton; we import the real _register
 * side-effect file to trigger all registerTool() calls, then assert counts.
 *
 * NOTE: tools that call getSupabaseServerClient() or createEmbedding() at
 * module scope (they don't — registration is deferred to handler invocation)
 * are safe here. The handlers are never invoked in these tests.
 */

import { describe, it, expect, vi } from "vitest";

// Mock supabase-server so importing tool files doesn't explode in test env
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: () => ({}),
}));

// Mock embeddings
vi.mock("@/server/embeddings", () => ({
  createEmbedding: async () => null,
}));

// Mock cosine (not strictly needed but keeps it clean)
vi.mock("@/lib/cosine", () => ({
  cosineSimilarity: () => 0,
}));

// Import registry + trigger all side-effect registrations
import "../_register";
import { allTools, nonWriteTools, getTool } from "../registry";

const EXPECTED_TOTAL = 24;
const EXPECTED_NON_WRITE = 20; // 24 total − 4 write-gated

const EXPECTED_NAMES = [
  // existing 5
  "query_defects",
  "query_claims",
  "trace_batch",
  "weekly_quality_summary",
  "semantic_search_signals",
  // new retrieval 3
  "pareto_defect_codes",
  "bom_parts_for_product",
  "test_results_marginal",
  // signal-incident 3
  "get_incident",
  "list_signals_for_incident",
  "find_related_incidents",
  // cross-boundary 3
  "field_vs_factory_gap",
  "operator_effect_analysis",
  "rework_timeline_by_section",
  // semantic-vision-lessons 2
  "retrieve_lessons",
  "classify_defect_image",
  // simulation 1
  "simulate_impact",
  // write-gated 4
  "create_initiative",
  "register_closure_predicate",
  "emit_lesson",
  "emit_impact_measurement",
  // contributions 3
  "contrib_central_quality",
  "contrib_plant_quality",
  "contrib_supplier_quality",
];

const WRITE_GATED_NAMES = [
  "create_initiative",
  "register_closure_predicate",
  "emit_lesson",
  "emit_impact_measurement",
];

const STUB_NAMES = [
  "find_related_incidents",
  "test_results_marginal",
  "operator_effect_analysis",
  "rework_timeline_by_section",
  "classify_defect_image",
  "simulate_impact",
  "emit_lesson",
  "emit_impact_measurement",
];

describe("registry-contents smoke test", () => {
  it(`has exactly ${EXPECTED_TOTAL} tools registered`, () => {
    expect(allTools()).toHaveLength(EXPECTED_TOTAL);
  });

  it(`has exactly ${EXPECTED_NON_WRITE} non-write tools`, () => {
    expect(nonWriteTools()).toHaveLength(EXPECTED_NON_WRITE);
  });

  it("registers every expected tool name", () => {
    const registeredNames = allTools().map((t) => t.name);
    for (const name of EXPECTED_NAMES) {
      expect(registeredNames, `missing tool: ${name}`).toContain(name);
    }
  });

  it("marks write-gated tools with is_write=true", () => {
    for (const name of WRITE_GATED_NAMES) {
      const tool = getTool(name);
      expect(tool, `tool not found: ${name}`).toBeDefined();
      expect(tool?.is_write, `${name} should have is_write=true`).toBe(true);
    }
  });

  it("marks stub tools with is_stub=true", () => {
    for (const name of STUB_NAMES) {
      const tool = getTool(name);
      expect(tool, `tool not found: ${name}`).toBeDefined();
      expect(tool?.is_stub, `${name} should have is_stub=true`).toBe(true);
    }
  });

  it("excludes write-gated tools from nonWriteTools()", () => {
    const nonWriteNames = nonWriteTools().map((t) => t.name);
    for (const name of WRITE_GATED_NAMES) {
      expect(nonWriteNames, `${name} should NOT be in nonWriteTools`).not.toContain(name);
    }
  });
});
