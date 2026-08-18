import type { DiagnosticItem, FastbootVitals } from '@/features/flasher/model/flasherTypes';
import { FlashAuditLogCard } from '@/features/flasher/overview/FlashAuditLogCard';
import { FlasherKnowledgeBase } from '@/features/flasher/overview/FlasherKnowledgeBase';
import { PartitionHierarchyDiagram } from '@/features/flasher/overview/PartitionHierarchyDiagram';
import { PreFlightDiagnosticMatrix } from '@/features/flasher/overview/PreFlightDiagnosticMatrix';

interface FlasherOverviewTabProps {
  diagnostics?: DiagnosticItem[];
  isFastbootMode: boolean;
  isProbing: boolean;
  onRebootBootloader?: () => void;
  onRefresh: () => void;
  vitals: FastbootVitals;
}

export function FlasherOverviewTab({
  vitals,
  diagnostics,
  isProbing,
  onRefresh,
  onRebootBootloader,
  isFastbootMode,
}: FlasherOverviewTabProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Row 1: Hardware Partition Hierarchy Diagram & Diagnostic Matrix */}
      <div className="grid @3xl:grid-cols-2 grid-cols-1 items-stretch gap-5">
        <div className="flex">
          <PartitionHierarchyDiagram activeSlot={vitals.activeSlot} />
        </div>
        <div className="flex">
          <PreFlightDiagnosticMatrix
            diagnostics={diagnostics ?? []}
            isFastbootMode={isFastbootMode}
            isProbing={isProbing}
            onRebootBootloader={onRebootBootloader}
            onRefresh={onRefresh}
            vitals={vitals}
          />
        </div>
      </div>

      {/* Row 2: Flasher Knowledge Base & Flash Audit Log */}
      <div className="grid @3xl:grid-cols-2 grid-cols-1 items-stretch gap-5">
        <div className="flex">
          <FlasherKnowledgeBase />
        </div>
        <div className="flex">
          <FlashAuditLogCard />
        </div>
      </div>
    </div>
  );
}
