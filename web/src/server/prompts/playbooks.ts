export const archetypePlaybooks: Record<string, string[]> = {
  supplier: ["query_defects", "trace_batch", "semantic_search_signals", "query_claims"],
  drift: ["weekly_quality_summary", "query_defects", "semantic_search_signals"],
  design: ["query_claims", "semantic_search_signals", "query_defects"],
  operator: ["query_defects", "weekly_quality_summary"],
  unknown: ["query_defects", "query_claims", "weekly_quality_summary"],
};
