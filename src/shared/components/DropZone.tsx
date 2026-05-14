import { Upload } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { OnFileDrop, OnFileDropOff } from '@/desktop/runtime';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

interface DropZoneProps {
  /** Allowed file extensions (e.g. ['.apk', '.apks']). Empty = accept all. */
  acceptExtensions?: string[];
  /** Browse button text. */
  browseLabel?: string;
  /** Additional class names for the container. */
  className?: string;
  /** Disables drop zone and browse button. */
  disabled?: boolean;
  /** Icon to show in the center. Defaults to Upload. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Main text label. */
  label?: string;
  /** Click handler for the browse button. */
  onBrowse: () => void;
  /** Called when valid files are dropped or selected. */
  onFilesDropped: (paths: string[]) => void;
  /** Toast message shown when dropped files don't match extensions. */
  rejectMessage?: string;
  /** Secondary hint text. */
  sublabel?: string;
}

/** Check if a point (x, y) falls within a DOMRect. */
function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function DropZone({
  onFilesDropped,
  acceptExtensions = [],
  rejectMessage,
  onBrowse,
  disabled = false,
  label = 'Drop files here',
  sublabel,
  icon: Icon = Upload,
  browseLabel = 'Browse Files',
  className,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter files by extension
  const filterFiles = useCallback(
    (paths: string[]): string[] => {
      if (acceptExtensions.length === 0) {
        return paths;
      }
      return paths.filter((p) => {
        const lower = p.toLowerCase();
        return acceptExtensions.some((ext) => lower.endsWith(ext.toLowerCase()));
      });
    },
    [acceptExtensions],
  );

  // Register Tauri native drag-drop handler with position-based hit-testing
  useEffect(() => {
    if (disabled) {
      return;
    }

    OnFileDrop({
      onHover: (x, y) => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }

        // Only highlight when cursor is physically over this component
        const rect = containerRef.current?.getBoundingClientRect();
        const isOver = rect ? isPointInRect(x, y, rect) : false;
        setIsDragging(isOver);

        // Auto-hide if no events for 150ms (cursor left window)
        hoverTimeoutRef.current = setTimeout(() => {
          setIsDragging(false);
        }, 150);
      },

      onDrop: (paths) => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setIsDragging(false);

        if (paths.length === 0) {
          return;
        }

        const valid = filterFiles(paths);
        if (valid.length === 0) {
          toast.error(rejectMessage ?? `No valid files. Accepted: ${acceptExtensions.join(', ')}`);
          return;
        }

        onFilesDropped(valid);
      },

      onCancel: () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setIsDragging(false);
      },
    });

    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      OnFileDropOff();
    };
  }, [disabled, filterFiles, onFilesDropped, rejectMessage, acceptExtensions]);

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all duration-200',
        isDragging
          ? 'scale-[1.01] border-primary bg-primary/5 shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_15%,transparent)]'
          : 'border-muted-foreground/25 hover:border-muted-foreground/40',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      ref={containerRef}
    >
      {/* Drag-over overlay */}
      {isDragging ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5 backdrop-blur-[2px]">
          <div className="fade-in zoom-in-95 flex animate-in flex-col items-center gap-2 text-primary duration-150">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="size-8 animate-bounce" />
            </div>
            <p className="font-semibold text-sm">Drop to add files</p>
          </div>
        </div>
      ) : null}

      {/* Default state */}
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

        {sublabel ? <p className="text-muted-foreground/40 text-xs">{sublabel}</p> : null}
      </div>
    </div>
  );
}
