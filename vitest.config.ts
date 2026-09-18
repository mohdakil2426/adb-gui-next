import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

// vite.config.ts exports a UserConfigFnObject — resolve it to a plain UserConfig object.
// mergeConfig only accepts a plain object, not a factory function.
const resolvedViteConfig = viteConfig({
  command: "serve",
  isPreview: false,
  isSsrBuild: false,
  mode: "test",
});

export default mergeConfig(
  resolvedViteConfig,
  defineConfig({
    test: {
      coverage: {
        exclude: ["src/test/**", "src/vite-env.d.ts"],
        include: ["src/**/*.{ts,tsx}"],
        provider: "v8",
      },
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
      testTimeout: 15_000,
    },
  })
);
