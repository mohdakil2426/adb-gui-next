import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { cn } from '@/shared/utils/cn';

interface FileSelectorProps {
  className?: string;
  /** Whether the selector should be fully disabled */
  disabled?: boolean;
  /** Icon shown at the start of the button (replaces spinner when not loading) */
  icon?: ReactNode;
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
  trailingAction?: ReactNode;
}

/**
 * A file/directory selector row: label, a control showing the file name, an
 * optional trailing action, and the full path below in the monospace face.
 *
 * The full path is rendered as visible text rather than a native `title`
 * tooltip — screen readers and keyboard users never see `title`.
 */
export function FileSelector({
  label,
  path,
  onSelect,
  placeholder = 'Select file…',
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
          className="min-w-0 flex-1 justify-start overflow-hidden"
          disabled={disabled || isLoading}
          onClick={onSelect}
          size="sm"
          type="button"
          variant="secondary"
        >
          {isLoading ? (
            <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
          ) : icon ? (
            <span aria-hidden="true" className="flex size-4 shrink-0 items-center">
              {icon}
            </span>
          ) : null}
          <span className="truncate">{path ? path.split(/[/\\]/).pop() : placeholder}</span>
        </Button>
        {trailingAction}
      </div>
      {path ? (
        <FieldDescription className="break-all font-mono text-mono-sm">{path}</FieldDescription>
      ) : null}
    </Field>
  );
}
