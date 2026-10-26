import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

// Database tests: run against the linked Supabase project with the keys in .env.local.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.e2e.test.ts"],
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 600_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      "server-only": path.resolve(import.meta.dirname, "tests/e2e/server-only-stub.ts"),
    },
  },
});
