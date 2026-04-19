import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // server-only is a Next.js package that throws at import time outside the
      // Next.js runtime. In vitest (node environment) we stub it as a no-op so
      // server-side modules can be unit-tested without the full Next.js stack.
      "server-only": path.resolve(__dirname, "./src/__mocks__/server-only.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
