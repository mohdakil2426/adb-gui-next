import { CheckCircle2, Clock, HardDrive, Loader2, ShieldCheck, XCircle } from "lucide-react";
import React from "react";

import type { backend } from "@/desktop/models";
import { PARTITION_GRID_COLUMNS } from "@/features/payload-dumper/ui/partition-grid";
import { CheckboxItem } from "@/shared/components/checkbox-item";
import { cn } from "@/shared/utils/cn";
import { formatBytes } from "@/shared/utils/format";

import { ExtractionProgressBar } from "./extraction-progress-bar";

interface PartitionRowProps {
  disabled: boolean;
  extractStatus?: backend.PartitionExtractStatus | undefined;
  index: number;
  onToggle: (index: number) => void;
  partition: { name: string; size: number; selected: boolean };
  progressPercent: number;
  showProgress: boolean;
  throughputMbps?: number | undefined;
}

/**
 * Single partition row in the partition table.
 * Memoized to prevent unnecessary re-renders when other rows update.
 */
const statusBadgeClass = (status: backend.PartitionExtractStatus): string => {
  switch (status) {
    case "completed": {
      return "bg-success-muted text-success";
    }
    case "failed": {
      return "bg-destructive-muted text-destructive";
    }
    case "running":
    case "verifying": {
      return "bg-primary-muted text-primary";
    }
    default: {
      return "bg-muted text-muted-foreground";
    }
  }
};

const getHardDriveColor = (isCompleted: boolean, selected: boolean): string => {
  if (isCompleted) {
    return "text-success";
  }
  if (selected) {
    return "text-primary";
  }
  return "text-foreground-subtle";
};

const PartitionStatusIcon = ({
  extractStatus,
  isCompleted,
  selected,
}: {
  extractStatus?: backend.PartitionExtractStatus | undefined;
  isCompleted: boolean;
  selected: boolean;
}) => {
  if (extractStatus === "running") {
    return <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin text-primary" />;
  }
  if (extractStatus === "verifying") {
    return (
      <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 animate-pulse text-primary" />
    );
  }
  if (extractStatus === "pending") {
    return <Clock aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  if (extractStatus === "failed") {
    return <XCircle aria-hidden="true" className="size-3.5 shrink-0 text-destructive" />;
  }
  return (
    <HardDrive
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", getHardDriveColor(isCompleted, selected))}
    />
  );
};

const renderCheckboxColumn = (
  isCompleted: boolean,
  isFailed: boolean,
  selected: boolean,
  disabled?: boolean
) => {
  if (isCompleted) {
    return <CheckCircle2 aria-label="Completed" className="size-4 text-success" />;
  }
  if (isFailed) {
    return <XCircle aria-label="Failed" className="size-4 text-destructive" />;
  }
  return <CheckboxItem checked={selected} {...(disabled === undefined ? {} : { disabled })} />;
};

const getPartitionNameColor = (
  isCompleted: boolean,
  isFailed: boolean,
  selected: boolean
): string => {
  if (isCompleted) {
    return "text-success";
  }
  if (isFailed) {
    return "text-destructive";
  }
  if (selected) {
    return "text-foreground";
  }
  return "text-muted-foreground";
};

const getPartitionSizeColor = (isCompleted: boolean, isFailed: boolean): string => {
  if (isCompleted) {
    return "font-medium text-success";
  }
  if (isFailed) {
    return "font-medium text-destructive";
  }
  return "text-muted-foreground";
};

export const PartitionRow = React.memo(
  ({
    partition,
    index,
    extractStatus,
    progressPercent,
    throughputMbps,
    showProgress,
    onToggle,
    disabled,
  }: PartitionRowProps) => {
    const isCompleted = extractStatus === "completed";
    const isFailed = extractStatus === "failed";
    const isPending = extractStatus === "pending";
    const isRunning = extractStatus === "running";
    const isVerifying = extractStatus === "verifying";
    const isActive = isPending || isRunning || isVerifying;
    const rowDisabled = disabled || isCompleted || isFailed;

    return (
      <button
        className={cn(
          "grid w-full items-center gap-2 px-3 py-2 text-left text-body transition-colors duration-90 ease-standard",
          !rowDisabled && "cursor-pointer hover:bg-accent",
          partition.selected && !isCompleted && !isFailed && "bg-primary-muted",
          isCompleted && "bg-success-muted",
          isFailed && "bg-destructive-muted"
        )}
        disabled={rowDisabled}
        onClick={() => {
          if (!rowDisabled) {
            onToggle(index);
          }
        }}
        style={{ gridTemplateColumns: PARTITION_GRID_COLUMNS }}
        type="button"
      >
        {/* Checkbox / terminal status icon */}
        {renderCheckboxColumn(isCompleted, isFailed, partition.selected, disabled)}

        {/* Name + status indicator */}
        <div className="flex min-w-0 items-center gap-2">
          <PartitionStatusIcon
            extractStatus={extractStatus}
            isCompleted={isCompleted}
            selected={partition.selected}
          />
          <span
            className={cn(
              "min-w-0 truncate font-mono text-mono",
              getPartitionNameColor(isCompleted, isFailed, partition.selected)
            )}
            title={`${partition.name}.img`}
          >
            {partition.name}.img
          </span>
          {extractStatus && showProgress ? (
            <span
              className={cn(
                "shrink-0 rounded-sm px-1.5 py-0.5 text-caption uppercase",
                statusBadgeClass(extractStatus)
              )}
            >
              {extractStatus}
            </span>
          ) : null}
        </div>

        {/* Progress — the column is always reserved, so the row never reflows */}
        <div className="flex min-w-0 flex-col items-stretch justify-center gap-0.5">
          {showProgress ? (
            <>
              <ExtractionProgressBar
                isCompleted={isCompleted}
                isExtracting={isActive}
                isFailed={isFailed}
                realProgress={progressPercent}
              />
              {isRunning &&
              throughputMbps !== null &&
              throughputMbps !== undefined &&
              throughputMbps > 0 ? (
                <span className="numeric text-center text-caption text-muted-foreground">
                  {throughputMbps.toFixed(1)} MB/s
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Size */}
        <span
          className={cn(
            "numeric text-right text-caption",
            getPartitionSizeColor(isCompleted, isFailed)
          )}
        >
          {formatBytes(partition.size)}
        </span>
      </button>
    );
  }
);
