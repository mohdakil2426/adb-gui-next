/** Chart ramp cycles if a device reports more than five volumes. */
const SEGMENT_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/**
 * Stable color for a volume's segment in the capacity map. Shared by
 * `StorageAllocationBar` (the track) and `StoragePanel`'s rows (the legend
 * dots), so a row and its segment always match.
 */
export function storageSegmentColor(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length] ?? 'var(--chart-1)';
}
