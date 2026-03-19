import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["convex/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/_generated/**"],
  },
});
