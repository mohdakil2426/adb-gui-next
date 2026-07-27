import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { handleError } from '@/shared/utils/errorHandler';

/** How long the confirmation check stays up. */
const COPIED_FEEDBACK_MS = 2000;

interface CopyButtonProps {
  /** Extra class names for the button */
  className?: string;
  /** Noun used in the toast and the accessible name. Defaults to "Value". */
  label?: string;
  /** The text value to copy to clipboard */
  value: string;
}

/**
 * Copies a value to the OS clipboard via the Tauri clipboard plugin and shows a
 * transient check.
 *
 * The reset timer is owned by a ref and cleared on unmount — the previous
 * version left a bare `setTimeout` behind, which set state on an unmounted
 * component whenever a row was copied and then scrolled out of a virtual list.
 */
export function CopyButton({ value, label = 'Value', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    if (!value) {
      return;
    }
    try {
      await writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
      resetTimer.current = setTimeout(() => {
        setCopied(false);
      }, COPIED_FEEDBACK_MS);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      handleError(
        'Copy',
        new Error(`${reason}. Select the text and press Ctrl+C to copy it manually.`),
      );
    }
  }, [label, value]);

  return (
    <Button
      aria-label={`Copy ${label}`}
      className={cn('shrink-0', className)}
      disabled={!value}
      onClick={() => {
        void handleCopy();
      }}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      {copied ? (
        <Check aria-hidden="true" className="size-3.5 text-success" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
    </Button>
  );
}
