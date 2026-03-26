import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      path: 'path-browserify',
    },
  },
  // Prevent Vite from obscuring Rust errors
  clearScreen: false,
  // Expose TAURI_ENV_* variables to frontend via import.meta.env
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: [
        '**/src-tauri/**',
        '**/docs/**',
        '**/.agent/**',
        '**/.agents/**',
        '**/.claude/**',
        '**/memory-bank/**',
        '**/.clinerules',
      ],
    },
  },
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Don't minify debug builds — easier to debug; minify release builds with esbuild
    minify: process.env.TAURI_ENV_DEBUG ? false : ('esbuild' as const),
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Raise warning limit — vendor chunks split below keeps individual chunks small
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split large vendors into cacheable chunks (function form required by Rollup types)
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('/react@'))
              return 'react-vendor';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('@tauri-apps')) return 'tauri';
            if (id.includes('@tanstack')) return 'query';
            if (id.includes('@radix-ui') || id.includes('radix-ui')) return 'radix';
          }
        },
      },
    },
  },
}));
