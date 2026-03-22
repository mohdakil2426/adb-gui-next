import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  /** The text value to copy to clipboard */
  value: string;
  /** Optional label for the toast and aria-label. Defaults to "Value" */
  label?: string;
  /** Extra class names for the button */
  className?: string;
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
    if (!value) return;
    try {
      await writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('shrink-0 h-7 w-7', className)}
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      disabled={!value}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
