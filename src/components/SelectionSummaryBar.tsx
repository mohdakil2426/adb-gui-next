import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SelectionSummaryBarProps {
  /** Number of currently selected items */
  count: number;
  /** Noun for items — e.g. "package(s)", "file(s)" */
  label: string;
  /** Called when the clear button is clicked */
  onClear: () => void;
  /** Disables the clear button */
  disabled?: boolean;
  className?: string;
}

/**
 * A compact bar shown below a list when one or more items are selected.
 * Displays the selection count and a "Clear" button.
 */
export function SelectionSummaryBar({
  count,
  label,
  onClear,
  disabled = false,
  className,
}: SelectionSummaryBarProps) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        'text-sm text-muted-foreground p-2 bg-muted rounded-md flex justify-between items-center',
        className,
      )}
    >
      <span>
        Selected: <span className="font-medium text-foreground">{count}</span> {label}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs hover:text-destructive"
        onClick={onClear}
        disabled={disabled}
      >
        Clear
      </Button>
    </div>
  );
}
