import { Check } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/shared/utils/cn';

interface CheckboxItemProps {
  checked: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * A consistent checkbox indicator used in virtualised list items
 * (AppManager package list, PayloadDumper partition list).
 */
export const CheckboxItem = memo(function CheckboxItem({
  checked,
  disabled = false,
  className,
}: CheckboxItemProps) {
  return (
    <div
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked
          ? 'border-primary bg-primary'
          : disabled
            ? 'border-muted-foreground/30 opacity-50'
            : 'border-muted-foreground/50',
        className,
      )}
    >
      {checked ? <Check className="size-3 text-primary-foreground" /> : null}
    </div>
  );
});
