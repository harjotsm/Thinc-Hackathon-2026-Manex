import { describe, it, expect } from "vitest";
import { relatedSignatures, ThemeForRelated } from "../related";

const t = (signature: string, vec: number[]): ThemeForRelated => ({
  signature,
  centroid_embedding: vec,
  member_count: 2,
});

describe("relatedSignatures", () => {
  it("returns empty map when no themes", () => {
    expect(relatedSignatures([])).toEqual(new Map());
  });

  it("does not relate themes with member_count < 2", () => {
    const a = { signature: "a", centroid_embedding: [1, 0], member_count: 1 };
    const b = { signature: "b", centroid_embedding: [1, 0], member_count: 2 };
    const m = relatedSignatures([a, b], { threshold: 0.5 });
    expect(m.get("a") ?? []).toEqual([]);
    expect(m.get("b") ?? []).toEqual([]);
  });

  it("relates themes whose cosine similarity exceeds the threshold", () => {
    const a = t("a", [1, 0, 0]);
    const b = t("b", [0.99, 0.1, 0]);
    const c = t("c", [0, 1, 0]);
    const m = relatedSignatures([a, b, c], { threshold: 0.85 });
    expect(m.get("a")).toContain("b");
    expect(m.get("b")).toContain("a");
    expect(m.get("c") ?? []).toEqual([]);
  });

  it("ignores themes with null embedding", () => {
    const a = t("a", [1, 0]);
    const b = { signature: "b", centroid_embedding: null, member_count: 2 };
    expect(relatedSignatures([a, b]).get("b") ?? []).toEqual([]);
  });
});
