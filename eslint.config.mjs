import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent scratch worktrees - stale copies of src/, not part of the app.
    ".claude/**",
    ".data/**",
    // Harness-installed skill/plugin infrastructure - gitignored, not part of the app.
    ".agents/**",
  ]),
]);

export default eslintConfig;
