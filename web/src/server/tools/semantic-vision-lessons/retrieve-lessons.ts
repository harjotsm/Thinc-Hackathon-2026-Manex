import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool } from "../registry";
import { createEmbedding } from "@/server/embeddings";
import { cosineSimilarity } from "@/lib/cosine";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  query_text: z.string().min(1),
  top_k: z.number().int().min(1).max(20).optional(),
  min_cosine: z.number().min(0).max(1).optional(),
});
type Input = z.infer<typeof Input>;

const CANDIDATE_CAP = 200;

export const retrieveLessons = async (input: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();
  const topK = input.top_k ?? 5;
  const minCosine = input.min_cosine ?? 0.75;

  const queryEmb = await createEmbedding(input.query_text);

  if (!queryEmb) {
    // Fallback: return top_k approved lessons ordered by created_ts (no usage_count column)
    const { data, error } = await supabase
      .from("lesson")
      .select("lesson_id,fix_summary,prompt_snippet,signature_text,archetype")
      .eq("engineer_validated", "approved")
      .is("superseded_by", null)
      .order("created_ts", { ascending: false })
      .limit(topK);
    if (error) throw new Error(`retrieve_lessons fallback failed: ${error.message}`);
    return {
      tool_call_id: makeId("TC"),
      tool: "retrieve_lessons",
      summary: `Embedding unavailable; returned ${(data ?? []).length} recent lessons as fallback.`,
      data: (data ?? []).map((r) => ({ ...r, cosine: null, usage_count: 0 })),
    };
  }

  const { data: candidates, error } = await supabase
    .from("lesson")
    .select(
      "lesson_id,fix_summary,prompt_snippet,signature_text,archetype,embedding",
    )
    .eq("engineer_validated", "approved")
    .is("superseded_by", null)
    .limit(CANDIDATE_CAP);

  if (error) throw new Error(`retrieve_lessons candidates failed: ${error.message}`);

  const scored = (candidates ?? [])
    .map((row) => {
      const emb = Array.isArray(row.embedding) ? (row.embedding as number[]) : null;
      const cosine = emb && emb.length === 1536 ? cosineSimilarity(queryEmb, emb) : -1;
      return {
        lesson_id: row.lesson_id as string,
        title: row.fix_summary as string,
        prompt_snippet: row.prompt_snippet as string | null,
        signature_text: row.signature_text as string,
        archetype: row.archetype as string | null,
        cosine,
        usage_count: 0,
      };
    })
    .filter((r) => r.cosine >= minCosine)
    .sort((a, b) => b.cosine - a.cosine)
    .slice(0, topK);

  return {
    tool_call_id: makeId("TC"),
    tool: "retrieve_lessons",
    summary: `App-side cosine over ${(candidates ?? []).length} approved lessons; returned top ${scored.length}.`,
    data: scored,
  };
};

registerTool({
  name: "retrieve_lessons",
  description:
    "Retrieve approved lessons semantically similar to a query via OpenAI embeddings + app-side cosine (pgvector unavailable).",
  input_schema: Input,
  handler: async (input) => retrieveLessons(input),
  groups: ["semantic", "lessons"],
});
