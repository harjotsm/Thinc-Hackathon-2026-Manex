import { cosineSimilarity } from "@/lib/cosine";

export type ThemeForRelated = {
  signature: string;
  centroid_embedding: number[] | null;
  member_count: number;
};

export type RelatedOptions = { threshold?: number };

export const relatedSignatures = (
  themes: ThemeForRelated[],
  opts: RelatedOptions = {},
): Map<string, string[]> => {
  const threshold = opts.threshold ?? 0.85;
  const out = new Map<string, string[]>();
  for (const t of themes) out.set(t.signature, []);

  const eligible = themes.filter(
    (t) => t.member_count >= 2 && t.centroid_embedding !== null,
  );

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i];
      const b = eligible[j];
      const sim = cosineSimilarity(a.centroid_embedding!, b.centroid_embedding!);
      if (sim >= threshold) {
        out.get(a.signature)!.push(b.signature);
        out.get(b.signature)!.push(a.signature);
      }
    }
  }

  return out;
};
