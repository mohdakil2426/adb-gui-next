import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// vite.config.ts exports a UserConfigFnObject — resolve it to a plain UserConfig object.
// mergeConfig only accepts a plain object, not a factory function.
const resolvedViteConfig = viteConfig({
  command: 'serve',
  mode: 'test',
  isSsrBuild: false,
  isPreview: false,
});

export default mergeConfig(
  resolvedViteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/vite-env.d.ts'],
      },
    },
  }),
);
