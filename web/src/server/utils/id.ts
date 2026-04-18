import { randomUUID } from "node:crypto";

export const makeId = (prefix: string) => {
  const entropy = randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
  return `${prefix}-${entropy}`;
};
