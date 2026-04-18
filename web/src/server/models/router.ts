import { getAnthropicClient } from "@/lib/anthropic";
import { systemPrompt } from "@/server/prompts/system";

const safeParseJson = <T>(content: string): T | null => {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

export const classifyArchetype = async (
  summary: string,
): Promise<"supplier" | "drift" | "design" | "operator" | "unknown"> => {
  const model = getAnthropicClient();
  if (!model) {
    const lowered = summary.toLowerCase();
    if (lowered.includes("batch") || lowered.includes("supplier")) return "supplier";
    if (lowered.includes("drift") || lowered.includes("vibration")) return "drift";
    if (lowered.includes("field") || lowered.includes("thermal")) return "design";
    if (lowered.includes("operator") || lowered.includes("rework")) return "operator";
    return "unknown";
  }

  const response = await model.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Classify this incident into one of: supplier, drift, design, operator, unknown. Return JSON only: {"archetype":"..."}. Incident summary: ${summary}`,
      },
    ],
  });

  const text = response.content
    .map((chunk) => ("text" in chunk ? chunk.text : ""))
    .join("")
    .trim();
  const parsed = safeParseJson<{ archetype?: string }>(text);
  const archetype = parsed?.archetype;
  if (archetype === "supplier" || archetype === "drift" || archetype === "design" || archetype === "operator") {
    return archetype;
  }
  return "unknown";
};
