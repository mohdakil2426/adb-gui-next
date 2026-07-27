/**
 * Partitions where the wrong image is not a recoverable mistake: it wipes user
 * data (`userdata`), takes every dynamic partition with it (`super`), or leaves
 * the device with no way to reach fastboot again (`bootloader`, `radio`,
 * `modem`, any `vbmeta*`). Flashing these requires typing the partition name.
 */
const HIGH_RISK_PARTITIONS = new Set(['userdata', 'super', 'bootloader', 'radio', 'modem']);

/** `boot_a` / `vbmeta_b` address the same physical partition as their base name. */
const SLOT_SUFFIX = /_[ab]$/;

export function normalizePartition(name: string): string {
  return name.trim().toLowerCase().replace(SLOT_SUFFIX, '');
}

export function isHighRiskPartition(name: string): boolean {
  const base = normalizePartition(name);
  return HIGH_RISK_PARTITIONS.has(base) || base.startsWith('vbmeta');
}

/**
 * Read one `name: value` line out of `fastboot getvar <name>` output.
 *
 * fastboot writes variables to stderr and the backend hands back stdout and
 * stderr combined, so scan every line rather than assuming a position.
 */
export function parseGetVar(output: string, name: string): string | null {
  const prefix = `${name}:`;
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith(prefix)) {
      const value = trimmed.slice(prefix.length).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}
