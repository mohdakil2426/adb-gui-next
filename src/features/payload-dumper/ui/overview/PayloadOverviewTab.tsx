import type { backend } from '@/desktop/models';
import { CompressionEfficiencyGauge } from '@/features/payload-dumper/ui/overview/CompressionEfficiencyGauge';
import { PartitionSizeBarChart } from '@/features/payload-dumper/ui/overview/PartitionSizeBarChart';
import { PayloadArchitectureGuide } from '@/features/payload-dumper/ui/overview/PayloadArchitectureGuide';
import { PayloadCompositionDonut } from '@/features/payload-dumper/ui/overview/PayloadCompositionDonut';
import { PayloadPresetsCard } from '@/features/payload-dumper/ui/overview/PayloadPresetsCard';

interface PartitionItem {
  name: string;
  selected: boolean;
  size: number;
}

interface PayloadOverviewTabProps {
  completedPartitions: Set<string>;
  onApplyPreset: (matcher: (name: string) => boolean) => void;
  onNavigateToExtractor: () => void;
  partitions: PartitionItem[];
  remoteMetadata: backend.RemotePayloadMetadata | null;
}

export function PayloadOverviewTab({
  partitions,
  completedPartitions,
  remoteMetadata,
  onApplyPreset,
  onNavigateToExtractor,
}: PayloadOverviewTabProps) {
  const totalUncompressedBytes = partitions.reduce((sum, p) => sum + p.size, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Dual Visualizer Charts (Pure SVG Donut & Top 10 Largest Horizontal Bars) */}
      <div className="grid @lg:grid-cols-2 grid-cols-1 items-stretch gap-4">
        <PayloadCompositionDonut partitions={partitions} />
        <PartitionSizeBarChart completedPartitions={completedPartitions} partitions={partitions} />
      </div>

      {/* Row 2: Quick Extraction Presets */}
      <PayloadPresetsCard
        onApplyPreset={onApplyPreset}
        onNavigateToExtractor={onNavigateToExtractor}
        partitions={partitions}
      />

      {/* Row 3: Compression Efficiency Metrics */}
      <CompressionEfficiencyGauge
        partitionsCount={partitions.length}
        remoteMetadata={remoteMetadata}
        totalUncompressedBytes={totalUncompressedBytes}
      />

      {/* Row 4: Deep Technical Architecture Guide (CrAU header, Protobuf manifest, Blob operations, Delta vs Full OTA) */}
      <PayloadArchitectureGuide />
    </div>
  );
}
