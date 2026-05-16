import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

interface CopyButtonProps {
  /** Extra class names for the button */
  className?: string;
  /** Optional label for the toast and aria-label. Defaults to "Value" */
  label?: string;
  /** The text value to copy to clipboard */
  value: string;
}

/**
 * A small icon button that copies the given value to the OS clipboard
 * using the Tauri clipboard-manager plugin.
 *
 * Shows a temporary checkmark after a successful copy.
 */
export function CopyButton({ value, label = 'Value', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) {
      return;
    }
    try {
      await writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Button
      aria-label={`Copy ${label}`}
      className={cn('size-7 shrink-0', className)}
      disabled={!value}
      onClick={handleCopy}
      size="icon"
      type="button"
      variant="ghost"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
