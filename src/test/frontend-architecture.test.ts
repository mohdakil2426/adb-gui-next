import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");

const sourceExtensions = new Set([".ts", ".tsx"]);
const shadcnPrimitiveDir = path.join(srcRoot, "shared", "ui");
const allowedLargeFiles = new Set([
  path.join(srcRoot, "shared", "ui", "sidebar.tsx"),
  path.join(srcRoot, "desktop", "backend.ts"),
  path.join(srcRoot, "desktop", "models.ts"),
  path.join(srcRoot, "features", "file-explorer", "file-explorer-view.tsx"),
  path.join(srcRoot, "features", "file-explorer", "ui", "file-explorer-toolbar.tsx"),
  path.join(srcRoot, "features", "emulator", "ui", "root-manual-step.tsx"),
  path.join(srcRoot, "features", "emulator", "ui", "emulator-cockpit-hero.tsx"),
  path.join(srcRoot, "features", "payload-dumper", "hooks", "use-payload-actions.ts"),
  path.join(srcRoot, "features", "payload-dumper", "model", "payload-dumper-store.ts"),
  path.join(srcRoot, "features", "payload-dumper", "ui", "overview", "payload-overview-tab.tsx"),
  path.join(
    srcRoot,
    "features",
    "payload-dumper",
    "ui",
    "marketplace",
    "payload-marketplace-tab.tsx"
  ),
  path.join(srcRoot, "features", "file-explorer", "hooks", "use-file-explorer-view-model.ts"),
  path.join(srcRoot, "features", "scrcpy", "toolbar", "scrcpy-floating-toolbar.tsx"),
  path.join(srcRoot, "features", "scrcpy", "scrcpy-cockpit-hero.tsx"),
  path.join(srcRoot, "features", "scrcpy", "binary", "scrcpy-binary-tab.tsx"),
  path.join(srcRoot, "features", "app-manager", "debloater", "ui", "installed-package-list.tsx"),
  path.join(srcRoot, "features", "app-manager", "debloater", "ui", "debloater-package-row.tsx"),
  path.join(srcRoot, "features", "app-manager", "debloater", "ui", "backup-restore-panel.tsx"),
  path.join(srcRoot, "features", "app-manager", "debloater", "ui", "pre-flight-apk-card.tsx"),
  path.join(srcRoot, "features", "marketplace", "ui", "app-detail", "readme-markdown.tsx"),
  path.join(srcRoot, "features", "marketplace", "ui", "app-detail-view.tsx"),
  path.join(srcRoot, "features", "marketplace", "sources", "github-auth-card.tsx"),
  path.join(srcRoot, "features", "dashboard", "ui", "device-hero-banner.tsx"),
  path.join(srcRoot, "features", "flasher", "overview", "pre-flight-diagnostic-matrix.tsx"),
  path.join(srcRoot, "features", "utilities", "host", "host-google-setup-card.tsx"),
  path.join(srcRoot, "features", "app-manager", "debloater", "ui", "description-panel.tsx"),
  path.join(srcRoot, "features", "app-manager", "debloater", "ui", "install-flags-cockpit.tsx"),
  path.join(srcRoot, "features", "app-manager", "debloater", "ui", "installed-apps-tab.tsx"),
  path.join(srcRoot, "features", "app-manager", "debloater", "ui", "installed-package-row.tsx"),
  path.join(srcRoot, "features", "emulator", "ui", "root-preflight-step.tsx"),
  path.join(srcRoot, "features", "emulator", "ui", "root-source-step.tsx"),
  path.join(srcRoot, "features", "emulator", "ui", "root-wizard.tsx"),
  path.join(
    srcRoot,
    "features",
    "file-explorer",
    "hooks",
    "use-file-explorer-keyboard-shortcuts.ts"
  ),
  path.join(srcRoot, "features", "file-explorer", "hooks", "use-file-explorer-transfers.ts"),
  path.join(srcRoot, "features", "file-explorer", "ui", "file-explorer-table-pane.tsx"),
  path.join(srcRoot, "features", "flasher", "ui", "flasher-cockpit-hero.tsx"),
  path.join(srcRoot, "features", "marketplace", "model", "marketplace-store.ts"),
  path.join(srcRoot, "features", "payload-dumper", "hooks", "payload-extraction-actions.ts"),
  path.join(srcRoot, "features", "payload-dumper", "ui", "payload-dumper-hero-banner.tsx"),
  path.join(srcRoot, "features", "scrcpy", "audio", "scrcpy-audio-tab.tsx"),
  path.join(srcRoot, "features", "scrcpy", "display", "scrcpy-display-tab.tsx"),
  path.join(srcRoot, "features", "scrcpy", "scrcpy-view.tsx"),
  path.join(srcRoot, "features", "utilities", "diagnostics", "logcat-stream-card.tsx"),
  path.join(srcRoot, "features", "utilities", "overview", "instant-actions-card.tsx"),
  path.join(srcRoot, "features", "utilities", "power", "system-tweaks-card.tsx"),
  path.join(srcRoot, "features", "utilities", "ui", "utilities-cockpit-hero.tsx"),
]);

const collectSourceFiles = (directory: string): string[] => {
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
};

const toPosixPath = (filePath: string): string => filePath.split(path.sep).join("/");

const collectFrontendImplementationFiles = (): string[] => [
  ...collectSourceFiles(path.join(srcRoot, "app")),
  ...collectSourceFiles(path.join(srcRoot, "features")),
  ...collectSourceFiles(path.join(srcRoot, "shared")),
];

describe("frontend architecture boundaries", () => {
  it("uses the strict top-level frontend folders", () => {
    const topLevelEntries = readdirSync(srcRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(topLevelEntries.toSorted()).toStrictEqual(
      ["app", "desktop", "features", "shared", "styles", "test"].toSorted()
    );
  });

  it("keeps Tauri invoke calls inside the desktop boundary", () => {
    const offenders = collectFrontendImplementationFiles()
      .map((filePath) => {
        const content = readFileSync(filePath, "utf-8");
        return {
          content,
          filePath,
        };
      })
      .filter(({ content }) => /invoke\s*\(/u.test(content))
      .map(({ filePath }) => toPosixPath(path.relative(repoRoot, filePath)));

    expect(offenders).toStrictEqual([]);
  });

  it("does not import from legacy frontend folders", () => {
    const legacyFolderPatterns = [
      /from\s+['"]@\/components\b/u,
      /from\s+['"]@\/hooks\b/u,
      /from\s+['"]@\/lib\b/u,
      /from\s+['"]@\/stores\b/u,
      /from\s+['"]@\/types\b/u,
      /from\s+['"]\.\.?\/.*(components|hooks|lib|stores|types)\b/u,
    ];

    const offenders = collectFrontendImplementationFiles()
      .map((filePath) => {
        const content = readFileSync(filePath, "utf-8");
        const matched = legacyFolderPatterns.some((pattern) => pattern.test(content));
        return { filePath, matched };
      })
      .filter(({ matched }) => matched)
      .map(({ filePath }) => toPosixPath(path.relative(repoRoot, filePath)));

    expect(offenders).toStrictEqual([]);
  });

  it("keeps feature implementation files small enough to review", () => {
    const offenders = collectSourceFiles(path.join(srcRoot, "features"))
      .filter((filePath) => !filePath.startsWith(shadcnPrimitiveDir))
      .filter((filePath) => !allowedLargeFiles.has(filePath))
      .map((filePath) => {
        const lines = readFileSync(filePath, "utf-8").split(/\r?\n/u).length;
        return { filePath, lines };
      })
      .filter(({ lines }) => lines > 300)
      .map(({ filePath, lines }) => `${toPosixPath(path.relative(repoRoot, filePath))}: ${lines}`);

    expect(offenders).toStrictEqual([]);
  });
});
