import { Upload } from 'lucide-react';
import type React from 'react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

interface DropAreaProps {
  browseLabel: string;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  isDragging: boolean;
  label: string;
  onBrowse: () => void;
  sublabel: string;
}

export function DropArea({
  isDragging,
  icon: Icon,
  label,
  sublabel,
  browseLabel,
  onBrowse,
  disabled = false,
}: DropAreaProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all duration-200',
        isDragging
          ? 'scale-[1.01] border-primary bg-primary/5 shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_15%,transparent)]'
          : 'border-muted-foreground/25 hover:border-muted-foreground/40',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {isDragging ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5 backdrop-blur-[2px]">
          <div className="fade-in zoom-in-95 flex animate-in flex-col items-center gap-2 text-primary duration-150">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="size-8 animate-bounce" />
            </div>
            <p className="font-semibold text-sm">Drop to add file</p>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'flex flex-col items-center gap-3 transition-opacity duration-150',
          isDragging && 'opacity-0',
        )}
      >
        <div className="rounded-full bg-muted p-3">
          <Icon className="size-6 text-muted-foreground/50" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="font-medium text-muted-foreground text-sm">{label}</p>
          <p className="text-muted-foreground/50 text-xs">or</p>
        </div>
        <Button disabled={disabled} onClick={onBrowse} size="sm" variant="outline">
          {browseLabel}
        </Button>
        <p className="text-muted-foreground/40 text-xs">{sublabel}</p>
      </div>
    </div>
  );
}
