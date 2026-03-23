import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxItemProps {
  checked: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * A consistent checkbox indicator used in virtualised list items
 * (AppManager package list, PayloadDumper partition list).
 */
export function CheckboxItem({ checked, disabled = false, className }: CheckboxItemProps) {
  return (
    <div
      className={cn(
        'h-4 w-4 shrink-0 rounded flex items-center justify-center border transition-colors',
        checked
          ? 'bg-primary border-primary'
          : disabled
            ? 'border-muted-foreground/30 opacity-50'
            : 'border-muted-foreground/50',
        className,
      )}
    >
      {checked && <Check className="h-3 w-3 text-primary-foreground" />}
    </div>
  );
}
