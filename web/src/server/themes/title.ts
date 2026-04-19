import "server-only";
import { getAnthropicClient } from "@/lib/anthropic";

export type ThemeTitleSource = "template" | "llm" | "fallback";
export type ThemeTitleInput = {
  archetype: string;
  dominantEntity: string | null;
  signalTexts: string[];
};
export type ThemeTitleResult = { title: string; source: ThemeTitleSource };

const cache = new Map<string, ThemeTitleResult>();
export const clearTitleCache = () => cache.clear();

const cacheKey = (i: ThemeTitleInput) =>
  `${i.archetype}|${i.dominantEntity ?? "—"}|${i.signalTexts.slice(0, 3).join("⋄").slice(0, 240)}`;

const template = (archetype: string, dominantEntity: string | null): string => {
  const archLabel = archetype.charAt(0).toUpperCase() + archetype.slice(1);
  return dominantEntity ? `${archLabel} · ${dominantEntity}` : "Untriaged";
};

const LLM_TIMEOUT_MS = 2000;

const llmTitle = async (signalTexts: string[], dominantEntity?: string | null): Promise<string | null> => {
  const client = getAnthropicClient();
  if (!client) return null;
  const sample = signalTexts.slice(0, 6).join(" | ").slice(0, 800);
  if (!sample) return null;

  const entityHint = dominantEntity ? `Signals about ${dominantEntity}:\n` : "Signals:\n";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const msg = await client.messages.create(
      {
        model: "claude-opus-4-7",
        max_tokens: 60,
        system: "You write 3–6 word quality-engineering theme titles. No periods. Format: '<Topic> · <key entity>'.",
        messages: [{ role: "user", content: `${entityHint}${sample}\n\nTitle:` }],
      },
      { signal: controller.signal },
    );
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
    if (!text) return null;
    return text.replace(/^["'`]+|["'`.]+$/g, "").slice(0, 80);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const themeTitle = async (input: ThemeTitleInput): Promise<ThemeTitleResult> => {
  // If we have a dominant entity AND archetype is NOT unknown, use template — fast and cheap.
  // For unknown archetype we always use the LLM (even if dominantEntity is set) to avoid
  // showing "Unknown · PM-00015" labels to judges.
  if (input.archetype !== "unknown" && input.dominantEntity !== null) {
    return { title: template(input.archetype, input.dominantEntity), source: "template" };
  }
  // Otherwise (unknown archetype, or any archetype with no entity) try the LLM.
  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached) return cached;

  const llm = await llmTitle(input.signalTexts, input.dominantEntity);
  const result: ThemeTitleResult = llm
    ? { title: llm, source: "llm" }
    : { title: "Untriaged", source: "fallback" };
  cache.set(key, result);
  return result;
};
