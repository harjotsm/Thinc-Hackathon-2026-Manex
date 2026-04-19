import { describe, it, expect } from "vitest";
import { stableStringify } from "../stable-stringify";

describe("stableStringify", () => {
  it("produces the same output for objects with shuffled keys", () => {
    const a = stableStringify({ a: 1, b: 2, c: 3 });
    const b = stableStringify({ c: 3, a: 1, b: 2 });
    const c = stableStringify({ b: 2, c: 3, a: 1 });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("preserves array order", () => {
    const result = stableStringify([3, 1, 2]);
    expect(result).toBe("[3,1,2]");
  });

  it("handles nested arrays inside objects", () => {
    const obj = { z: [1, 2], a: [3, 4] };
    const result = stableStringify(obj);
    // keys sorted: a first, then z
    expect(result).toBe('{"a":[3,4],"z":[1,2]}');
  });

  it("handles null", () => {
    expect(stableStringify(null)).toBe("null");
  });

  it("handles primitive numbers", () => {
    expect(stableStringify(42)).toBe("42");
  });

  it("handles primitive strings", () => {
    expect(stableStringify("hello")).toBe('"hello"');
  });

  it("handles booleans", () => {
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(false)).toBe("false");
  });

  it("handles nested objects deterministically", () => {
    const nested = { outer: { z: 1, a: 2 }, flag: true };
    const result = stableStringify(nested);
    // keys at top level: flag, outer (sorted)
    expect(result).toBe('{"flag":true,"outer":{"a":2,"z":1}}');
  });
});
