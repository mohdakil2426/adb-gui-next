import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');

const sourceExtensions = new Set(['.ts', '.tsx']);
const shadcnPrimitiveDir = path.join(srcRoot, 'shared', 'ui');
const allowedLargeFiles = new Set([
  path.join(srcRoot, 'shared', 'ui', 'sidebar.tsx'),
  path.join(srcRoot, 'desktop', 'backend.ts'),
  path.join(srcRoot, 'desktop', 'models.ts'),
  path.join(srcRoot, 'features', 'file-explorer', 'FileExplorerView.tsx'),
  path.join(srcRoot, 'features', 'emulator', 'ui', 'RootManualStep.tsx'),
]);

function collectSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }
  const entries = readdirSync(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (sourceExtensions.has(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function collectFrontendImplementationFiles(): string[] {
  return [
    ...collectSourceFiles(path.join(srcRoot, 'app')),
    ...collectSourceFiles(path.join(srcRoot, 'desktop')),
    ...collectSourceFiles(path.join(srcRoot, 'features')),
    ...collectSourceFiles(path.join(srcRoot, 'shared')),
  ];
}

describe('frontend architecture boundaries', () => {
  it('uses the strict top-level frontend folders', () => {
    expect(existsSync(path.join(srcRoot, 'app'))).toBe(true);
    expect(existsSync(path.join(srcRoot, 'desktop'))).toBe(true);
    expect(existsSync(path.join(srcRoot, 'features'))).toBe(true);
    expect(existsSync(path.join(srcRoot, 'shared'))).toBe(true);
    expect(existsSync(path.join(srcRoot, 'components', 'views'))).toBe(false);
    expect(existsSync(path.join(srcRoot, 'lib'))).toBe(false);
  });

  it('keeps Tauri invoke calls inside the desktop boundary', () => {
    const offenders = collectFrontendImplementationFiles().filter((filePath) => {
      const text = readFileSync(filePath, 'utf8');
      return (
        text.includes('@tauri-apps/api/core') &&
        toPosixPath(filePath) !== toPosixPath(path.join(srcRoot, 'desktop', 'backend.ts'))
      );
    });

    expect(offenders.map((filePath) => toPosixPath(path.relative(repoRoot, filePath)))).toEqual([]);
  });

  it('does not import from legacy frontend folders', () => {
    const legacyPatterns = [
      '@/components/views',
      '@/components/marketplace',
      '@/components/payload-dumper',
      '@/components/emulator-manager',
      '@/lib/',
    ];

    const offenders = collectFrontendImplementationFiles().flatMap((filePath) => {
      const text = readFileSync(filePath, 'utf8');
      return legacyPatterns
        .filter((pattern) => text.includes(pattern))
        .map((pattern) => `${toPosixPath(path.relative(repoRoot, filePath))}: ${pattern}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps feature implementation files small enough to review', () => {
    const offenders = collectSourceFiles(path.join(srcRoot, 'features'))
      .filter((filePath) => !filePath.startsWith(shadcnPrimitiveDir))
      .filter((filePath) => !allowedLargeFiles.has(filePath))
      .map((filePath) => {
        const lines = readFileSync(filePath, 'utf8').split(/\r?\n/).length;
        return { filePath, lines };
      })
      .filter(({ lines }) => lines > 300)
      .map(({ filePath, lines }) => `${toPosixPath(path.relative(repoRoot, filePath))}: ${lines}`);

    expect(offenders).toEqual([]);
  });
});
