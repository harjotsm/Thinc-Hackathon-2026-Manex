import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";
import { registerTool, invokeTool } from "../registry";
import type { ToolCallResult } from "@/server/agent/types";

const Input = z.object({
  incident_id: z.string().min(1),
});
type Input = z.infer<typeof Input>;

export const contribCentralQuality = async (args: Input): Promise<ToolCallResult> => {
  const supabase = getSupabaseServerClient();

  // 1. Load incident
  const { data: incident, error: incErr } = await supabase
    .from("incident")
    .select("incident_id,title,summary,signature_text,archetype")
    .eq("incident_id", args.incident_id)
    .single();

  if (incErr) throw new Error(`contrib_central_quality: incident fetch failed: ${incErr.message}`);

  const queryText =
    (incident.signature_text as string | null) ??
    (incident.summary as string | null) ??
    (incident.title as string | null) ??
    "";

  // 2. Retrieve top-3 prior lessons via registry (app-side cosine)
  const lessonsResult = await invokeTool("retrieve_lessons", {
    query_text: queryText,
    top_k: 3,
    min_cosine: 0.7,
  });

  const lessons = Array.isArray(lessonsResult.data) ? lessonsResult.data : [];
  const N = lessons.length;

  // 3. Compose contribution text
  const lessonLines = lessons
    .map(
      (l: Record<string, unknown>, i: number) =>
        `${i + 1}. [${l.archetype ?? "unknown"}] ${l.title ?? l.lesson_id}: ${l.prompt_snippet ?? ""}`,
    )
    .join("\n");

  const recommendation =
    N > 0
      ? `Based on ${N} prior lesson(s), consider archetype '${String(lessons[0].archetype ?? "unknown")}': ${String(lessons[0].title ?? "")}`
      : "No closely matched prior lessons found. Recommend manual root-cause analysis.";

  const content = [
    `Central Quality Assessment for incident ${args.incident_id}`,
    `Archetype: ${String(incident.archetype ?? "unknown")}`,
    ``,
    `Prior lessons matched (top ${N}):`,
    lessonLines || "  (none above threshold)",
    ``,
    `Recommendation: ${recommendation}`,
  ].join("\n");

  const structuredPayload = { lessons, recommendation };

  // 4. UPSERT into contribution
  const contributionId = makeId("CTB");
  const { error: upsertErr } = await supabase
    .from("contribution")
    .upsert(
      {
        contribution_id: contributionId,
        incident_id: args.incident_id,
        domain: "central_quality",
        source: "tool",
        status: "available",
        content,
        structured_payload: structuredPayload,
        weight: 1.0,
        created_ts: new Date().toISOString(),
      },
      { onConflict: "incident_id,domain,source" },
    );

  if (upsertErr)
    throw new Error(`contrib_central_quality upsert failed: ${upsertErr.message}`);

  return {
    tool_call_id: makeId("TC"),
    tool: "contrib_central_quality",
    summary: `Matched ${N} prior lessons for central quality.`,
    data: { ok: true, contribution_id: contributionId, lessons_matched: N },
  };
};

registerTool({
  name: "contrib_central_quality",
  description:
    "Compose the central_quality contribution card for an incident, matching prior lessons and upserting into the contribution table.",
  input_schema: Input,
  handler: async (input) => contribCentralQuality(input),
  groups: ["contributions"],
});
