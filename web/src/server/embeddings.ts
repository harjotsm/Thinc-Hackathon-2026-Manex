import { getOpenAIClient } from "@/lib/openai";

export const createEmbedding = async (text: string): Promise<number[] | null> => {
  const openai = getOpenAIClient();
  if (!openai || !text.trim()) {
    return null;
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  const [first] = response.data;
  return first?.embedding ?? null;
};

export const vectorLiteral = (embedding: number[] | null): string | null => {
  if (!embedding) {
    return null;
  }
  return `[${embedding.join(",")}]`;
};
