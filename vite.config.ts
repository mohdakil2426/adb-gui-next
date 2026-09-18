import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  build: {
    chunkSizeWarningLimit: 600,
    minify: process.env.TAURI_ENV_DEBUG ? false : ("oxc" as const),
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("/react/") || id.includes("/react@")) {
              return "react-vendor";
            }
            if (id.includes("framer-motion")) {
              return "motion";
            }
            if (id.includes("@tauri-apps")) {
              return "tauri";
            }
            if (id.includes("recharts") || id.includes("decimal.js-light")) {
              return "recharts";
            }
            if (id.includes("@tanstack")) {
              return "query";
            }
            if (id.includes("@radix-ui") || id.includes("radix-ui")) {
              return "radix";
            }
          }
        },
      },
    },
    sourcemap: !process.env.TAURI_ENV_DEBUG,
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
  },
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      path: "path-browserify",
    },
  },
  server: {
    hmr: host
      ? {
          host,
          port: 1421,
          protocol: "ws",
        }
      : undefined,
    host,
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/docs/**",
        "**/.agent/**",
        "**/.agents/**",
        "**/.claude/**",
        "**/memory-bank/**",
        "**/.clinerules",
      ],
    },
  },
}));
