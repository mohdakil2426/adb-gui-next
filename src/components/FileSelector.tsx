import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileSelectorProps {
  /** Label above the button (e.g. "Payload File") */
  label: string;
  /** Currently selected path to display */
  path: string;
  /** Callback when the select button is clicked */
  onSelect: () => void;
  /** Placeholder shown in the button when no path is selected */
  placeholder?: string;
  /** Whether a selection/loading operation is in progress */
  isLoading?: boolean;
  /** Whether the selector should be fully disabled */
  disabled?: boolean;
  /** Icon shown at the start of the button (replaces spinner when not loading) */
  icon?: React.ReactNode;
  /** Optional trailing action button (e.g. Refresh or Open Folder) */
  trailingAction?: React.ReactNode;
  className?: string;
}

/**
 * A standardised file/directory selector row: label, select button with path truncation,
 * optional trailing action button (e.g. open folder), and a full-path hint below.
 */
export function FileSelector({
  label,
  path,
  onSelect,
  placeholder = 'Select file...',
  isLoading = false,
  disabled = false,
  icon,
  trailingAction,
  className,
}: FileSelectorProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium">{label}</label>
      <div className="flex gap-2 min-w-0">
        <Button
          variant="secondary"
          className="flex-1 min-w-0 justify-start pl-4 overflow-hidden"
          onClick={onSelect}
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
          ) : icon ? (
            <span className="mr-2 h-4 w-4 shrink-0 flex items-center">{icon}</span>
          ) : null}
          <span className="truncate">{path ? path.split(/[/\\]/).pop() : placeholder}</span>
        </Button>
        {trailingAction}
      </div>
      {path && (
        <p className="text-xs text-muted-foreground truncate" title={path}>
          {path}
        </p>
      )}
    </div>
  );
}
