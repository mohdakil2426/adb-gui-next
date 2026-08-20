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
  path.join(srcRoot, 'features', 'file-explorer', 'ui', 'FileExplorerToolbar.tsx'),
  path.join(srcRoot, 'features', 'emulator', 'ui', 'RootManualStep.tsx'),
  // Pre-existing payload modules (over 300-line review budget; split tracked separately)
  path.join(srcRoot, 'features', 'payload-dumper', 'hooks', 'usePayloadActions.ts'),
  path.join(srcRoot, 'features', 'payload-dumper', 'model', 'payloadDumperStore.ts'),
  path.join(srcRoot, 'features', 'payload-dumper', 'ui', 'overview', 'PayloadOverviewTab.tsx'),
  path.join(
    srcRoot,
    'features',
    'payload-dumper',
    'ui',
    'marketplace',
    'PayloadMarketplaceTab.tsx',
  ),
  // Orchestrator hook already extracted from FileExplorerView; further split is separate work
  path.join(srcRoot, 'features', 'file-explorer', 'hooks', 'useFileExplorerViewModel.ts'),
  path.join(srcRoot, 'features', 'scrcpy', 'toolbar', 'ScrcpyFloatingToolbar.tsx'),
  path.join(srcRoot, 'features', 'app-manager', 'debloater', 'ui', 'InstalledPackageList.tsx'),
  path.join(srcRoot, 'features', 'marketplace', 'ui', 'app-detail', 'ReadmeMarkdown.tsx'),
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
    } else if (stat.isFile() && sourceExtensions.has(path.extname(entry))) {
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
    ...collectSourceFiles(path.join(srcRoot, 'features')),
    ...collectSourceFiles(path.join(srcRoot, 'shared')),
  ];
}

describe('frontend architecture boundaries', () => {
  it('uses the strict top-level frontend folders', () => {
    const topLevelEntries = readdirSync(srcRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(topLevelEntries.sort()).toEqual(
      ['app', 'desktop', 'features', 'shared', 'styles', 'test'].sort(),
    );
  });

  it('keeps Tauri invoke calls inside the desktop boundary', () => {
    const offenders = collectFrontendImplementationFiles()
      .map((filePath) => {
        const content = readFileSync(filePath, 'utf8');
        return {
          content,
          filePath,
        };
      })
      .filter(({ content }) => /invoke\s*\(/.test(content))
      .map(({ filePath }) => toPosixPath(path.relative(repoRoot, filePath)));

    expect(offenders).toEqual([]);
  });

  it('does not import from legacy frontend folders', () => {
    const legacyFolderPatterns = [
      /from\s+['"]@\/components\b/,
      /from\s+['"]@\/hooks\b/,
      /from\s+['"]@\/lib\b/,
      /from\s+['"]@\/stores\b/,
      /from\s+['"]@\/types\b/,
      /from\s+['"]\.\.?\/.*(components|hooks|lib|stores|types)\b/,
    ];

    const offenders = collectFrontendImplementationFiles()
      .map((filePath) => {
        const content = readFileSync(filePath, 'utf8');
        const matched = legacyFolderPatterns.some((pattern) => pattern.test(content));
        return { filePath, matched };
      })
      .filter(({ matched }) => matched)
      .map(({ filePath }) => toPosixPath(path.relative(repoRoot, filePath)));

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
