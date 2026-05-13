import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

interface SelectionSummaryBarProps {
  /** Optional action buttons rendered to the right of the count (before Clear) */
  actions?: React.ReactNode;
  className?: string;
  /** Number of currently selected items */
  count: number;
  /** Disables the clear button */
  disabled?: boolean;
  /** Noun for items — e.g. "package(s)", "file(s)" */
  label: string;
  /** Called when the clear button is clicked */
  onClear: () => void;
}

/**
 * A compact bar shown below a list when one or more items are selected.
 * Displays the selection count, optional action buttons, and a "Clear" button.
 */
export function SelectionSummaryBar({
  count,
  label,
  onClear,
  actions,
  disabled = false,
  className,
}: SelectionSummaryBarProps) {
  if (count === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-border border-b bg-muted/60 px-3 py-1.5 text-muted-foreground text-sm',
        className,
      )}
    >
      <span className="flex-1">
        <span className="font-medium text-foreground">{count}</span> {label}
      </span>
      {actions}
      <Button
        className="h-6 px-2 text-xs hover:text-destructive"
        disabled={disabled}
        onClick={onClear}
        size="sm"
        variant="ghost"
      >
        Clear
      </Button>
    </div>
  );
}
