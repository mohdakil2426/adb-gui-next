import { useState } from 'react';
import { PARTITION_PRESET_GROUPS } from '@/features/flasher/model/flasherConstants';
import { cn } from '@/shared/utils/cn';

interface PartitionSelectorChipsProps {
  disabled?: boolean;
  onSelectPartition: (partition: string) => void;
  selectedPartition: string;
}

export function PartitionSelectorChips({
  selectedPartition,
  onSelectPartition,
  disabled = false,
}: PartitionSelectorChipsProps) {
  const [activeGroup, setActiveGroup] = useState<string>('boot');

  const currentGroup =
    PARTITION_PRESET_GROUPS.find((g) => g.id === activeGroup) ?? PARTITION_PRESET_GROUPS[0];

  return (
    <div className="flex flex-col gap-2.5">
      {/* Group Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-border/70 border-b pb-2">
        {PARTITION_PRESET_GROUPS.map((group) => (
          <button
            className={cn(
              'rounded-md px-2.5 py-1 font-medium text-caption transition-colors',
              activeGroup === group.id
                ? 'bg-surface-raised font-semibold text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            disabled={disabled}
            key={group.id}
            onClick={() => setActiveGroup(group.id)}
            type="button"
          >
            {group.label}
          </button>
        ))}
      </div>

      {/* Partition Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {currentGroup?.partitions.map((p) => {
          const isSelected = selectedPartition.toLowerCase() === p.toLowerCase();
          return (
            <button
              className={cn(
                'flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[11px] transition-all',
                isSelected
                  ? 'border-primary bg-primary/10 font-bold text-primary shadow-xs'
                  : 'border-border bg-surface text-muted-foreground hover:border-foreground/30 hover:bg-surface-raised hover:text-foreground',
                disabled && 'pointer-events-none opacity-50',
              )}
              disabled={disabled}
              key={p}
              onClick={() => onSelectPartition(p)}
              type="button"
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
