/**
 * Shape and tuning constant for the "largest partitions" bar chart.
 *
 * These live apart from `PartitionSizeChart.tsx` so a *value* import of the
 * constant from `PartitionSizeSummary` cannot defeat that module's `React.lazy`
 * boundary — a static value edge across a lazy boundary silently collapses it.
 */

/** Beyond this the bars are thinner than their labels and stop informing. */
export const MAX_CHART_PARTITIONS = 8;

export interface PartitionSizeDatum {
  /** True once this partition has been written — recoloured, not hidden. */
  extracted: boolean;
  name: string;
  size: number;
}
