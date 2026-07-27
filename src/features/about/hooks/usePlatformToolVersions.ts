import { useQuery } from '@tanstack/react-query';
import { RunAdbHostCommand, RunFastbootHostCommand } from '@/desktop/backend';

export interface PlatformToolVersions {
  adb: string | null;
  fastboot: string | null;
}

/** `35.0.2-12147458` out of a multi-line `adb version` / `fastboot --version` banner. */
const VERSION_PATTERN = /\b\d+\.\d+\.\d+[\w.-]*/;

function extractVersion(output: string): string | null {
  return VERSION_PATTERN.exec(output)?.[0] ?? null;
}

async function readToolVersions(): Promise<PlatformToolVersions> {
  const [adb, fastboot] = await Promise.all([
    RunAdbHostCommand('version').catch(() => ''),
    RunFastbootHostCommand('--version', null).catch(() => ''),
  ]);

  return { adb: extractVersion(adb), fastboot: extractVersion(fastboot) };
}

/**
 * Versions of the bundled platform-tools.
 *
 * Two host spawns, only while the About view is mounted, and cached for the
 * session — the binaries cannot change underneath a running app.
 */
export function usePlatformToolVersions() {
  return useQuery({
    queryKey: ['about', 'platformToolVersions'],
    queryFn: readToolVersions,
    gcTime: Number.POSITIVE_INFINITY,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
