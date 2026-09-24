import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "**/.agents/**",
    "**/.github/**",
    "**/docs/**",
    "**/memory-bank/**",
    "**/src-tauri/**",
    "**/AGENTS.md",
    "src/shared/charts/**",
  ],
  printWidth: 100,
});
