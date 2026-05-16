import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { cn } from '@/shared/utils/cn';

interface FileSelectorProps {
  className?: string;
  /** Whether the selector should be fully disabled */
  disabled?: boolean;
  /** Icon shown at the start of the button (replaces spinner when not loading) */
  icon?: React.ReactNode;
  /** Whether a selection/loading operation is in progress */
  isLoading?: boolean;
  /** Label above the button (e.g. "Payload File") */
  label: string;
  /** Callback when the select button is clicked */
  onSelect: () => void;
  /** Currently selected path to display */
  path: string;
  /** Placeholder shown in the button when no path is selected */
  placeholder?: string;
  /** Optional trailing action button (e.g. Refresh or Open Folder) */
  trailingAction?: React.ReactNode;
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
    <Field className={cn('min-w-0 gap-1.5', className)}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex min-w-0 gap-2">
        <Button
          className="min-w-0 flex-1 justify-start overflow-hidden pl-4"
          disabled={disabled || isLoading}
          onClick={onSelect}
          variant="secondary"
        >
          {isLoading ? (
            <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
          ) : icon ? (
            <span className="mr-2 flex size-4 shrink-0 items-center">{icon}</span>
          ) : null}
          <span className="truncate">{path ? path.split(/[/\\]/).pop() : placeholder}</span>
        </Button>
        {trailingAction}
      </div>
      {path ? <FieldDescription className="break-all text-xs">{path}</FieldDescription> : null}
    </Field>
  );
}
