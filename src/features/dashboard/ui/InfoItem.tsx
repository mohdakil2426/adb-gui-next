import type React from 'react';
import { CopyButton } from '@/shared/components/CopyButton';
import { cn } from '@/shared/utils/cn';

export function InfoItem({
  copyable = false,
  icon,
  label,
  value,
  valueClassName,
}: {
  copyable?: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="group flex items-center gap-3 overflow-hidden rounded-lg bg-muted p-3">
      <div className="mr-3 shrink-0 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-muted-foreground text-sm">{label}</div>
        <div className={cn('truncate font-semibold', valueClassName)}>{value || 'N/A'}</div>
      </div>
      {copyable && value ? (
        <CopyButton
          className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          label={label}
          value={value}
        />
      ) : null}
    </div>
  );
}
