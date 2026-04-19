import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import { createEmbedding } from "@/server/embeddings";
import { cosineSimilarity } from "@/lib/cosine";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  query_text: z.string().min(1),
  filters: z
    .object({
      product_id: z.string().optional(),
      date_from: z.string().datetime().optional(),
      date_to: z.string().datetime().optional(),
    })
    .optional(),
  top_k: z.number().int().min(1).max(50).optional(),
});
type Input = z.infer<typeof Input>;

const CANDIDATE_CAP = 500; // tune for demo scale

export const semanticSearchSignals = async (input: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  const topK = input.top_k ?? 10;
  const queryEmb = await createEmbedding(input.query_text);

  if (!queryEmb) {
    // Fallback: return most recent matching-filter signals, no semantic sort
    let q = supabase
      .from("signal")
      .select("signal_id, captured_ts, raw_text, product_id")
      .not("embedding", "is", null)
      .order("captured_ts", { ascending: false })
      .limit(topK);
    if (input.filters?.product_id) q = q.eq("product_id", input.filters.product_id);
    const { data, error } = await q;
    if (error) throw new Error(`semantic_search_signals fallback failed: ${error.message}`);
    return {
      tool_call_id: makeId("TC"),
      tool: "semantic_search_signals",
      summary: `OpenAI embedding unavailable; returned ${(data ?? []).length} recent signals as fallback.`,
      data: (data ?? []).map((r) => ({ ...r, cosine: null })),
    };
  }

  let q = supabase
    .from("signal")
    .select("signal_id, captured_ts, raw_text, product_id, embedding")
    .not("embedding", "is", null)
    .limit(CANDIDATE_CAP);
  if (input.filters?.product_id) q = q.eq("product_id", input.filters.product_id);
  if (input.filters?.date_from) q = q.gte("captured_ts", input.filters.date_from);
  if (input.filters?.date_to) q = q.lte("captured_ts", input.filters.date_to);

  const { data: candidates, error } = await q;
  if (error) throw new Error(`semantic_search_signals failed: ${error.message}`);

  const scored = (candidates ?? [])
    .map(
      (row: {
        signal_id: string;
        captured_ts: string;
        raw_text: string | null;
        product_id: string | null;
        embedding: unknown;
      }) => {
        const emb = Array.isArray(row.embedding) ? (row.embedding as number[]) : null;
        const cosine = emb ? cosineSimilarity(queryEmb, emb) : -1;
        return {
          signal_id: row.signal_id,
          captured_ts: row.captured_ts,
          raw_text: row.raw_text,
          product_id: row.product_id,
          cosine,
        };
      },
    )
    .filter((r) => r.cosine !== -1)
    .sort((a, b) => b.cosine - a.cosine)
    .slice(0, topK);

  return {
    tool_call_id: makeId("TC"),
    tool: "semantic_search_signals",
    summary: `App-side cosine over ${(candidates ?? []).length} candidates; returned top ${scored.length}.`,
    data: scored,
  };
};

registerTool({
  name: "semantic_search_signals",
  description:
    "Semantic similarity search over signal.raw_text via OpenAI embeddings + app-side cosine (pgvector unavailable).",
  input_schema: Input,
  handler: async (input) => semanticSearchSignals(input),
  groups: ["retrieval", "semantic"],
});
