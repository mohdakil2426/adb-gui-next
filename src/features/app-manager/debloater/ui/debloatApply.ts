import { DebloatPackages } from '@/desktop/backend';
import type { backend } from '@/desktop/models';

/**
 * Packages handed to the backend per round-trip.
 *
 * Rust already batches up to 100 packages into a single `adb shell`, so the
 * only cost of a smaller chunk is one extra state read-back per chunk. That is
 * a good trade: without chunking a 300-package uninstall is a single opaque
 * `await` with nothing to report for minutes.
 */
export const APPLY_CHUNK_SIZE = 25;

export function chunkPackages(packages: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < packages.length; index += APPLY_CHUNK_SIZE) {
    chunks.push(packages.slice(index, index + APPLY_CHUNK_SIZE));
  }
  return chunks;
}

interface ApplyInChunksOptions {
  action: backend.DebloatAction;
  /** Called after every chunk with the number of packages processed so far. */
  onProgress: (processed: number, total: number) => void;
  packages: readonly string[];
  serial: string | null;
}

/**
 * Apply `action` to every package, one chunk at a time.
 *
 * Chunks run strictly in sequence — concurrent `pm` calls on one device race.
 * Uses a then-chain rather than `for await` for the same reason `mapSerial`
 * does in `InstallationTab`.
 */
export function applyInChunks({
  action,
  onProgress,
  packages,
  serial,
}: ApplyInChunksOptions): Promise<backend.DebloatActionResult[]> {
  const total = packages.length;
  return chunkPackages(packages).reduce<Promise<backend.DebloatActionResult[]>>(
    (previous, chunk) =>
      previous.then((collected) =>
        DebloatPackages([...chunk], action, 0, serial).then((results) => {
          const merged = collected.concat(results);
          onProgress(Math.min(merged.length, total), total);
          return merged;
        }),
      ),
    Promise.resolve([]),
  );
}
