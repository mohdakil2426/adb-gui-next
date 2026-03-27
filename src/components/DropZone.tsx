import React, { useCallback, useEffect, useRef, useState } from 'react';
import { OnFileDrop, OnFileDropOff } from '@/lib/desktop/runtime';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

interface DropZoneProps {
  /** Called when valid files are dropped or selected. */
  onFilesDropped: (paths: string[]) => void;
  /** Allowed file extensions (e.g. ['.apk', '.apks']). Empty = accept all. */
  acceptExtensions?: string[];
  /** Toast message shown when dropped files don't match extensions. */
  rejectMessage?: string;
  /** Click handler for the browse button. */
  onBrowse: () => void;
  /** Disables drop zone and browse button. */
  disabled?: boolean;
  /** Main text label. */
  label?: string;
  /** Secondary hint text. */
  sublabel?: string;
  /** Icon to show in the center. Defaults to Upload. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Browse button text. */
  browseLabel?: string;
  /** Additional class names for the container. */
  className?: string;
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter files by extension
  const filterFiles = useCallback(
    (paths: string[]): string[] => {
      if (acceptExtensions.length === 0) return paths;
      return paths.filter((p) => {
        const lower = p.toLowerCase();
        return acceptExtensions.some((ext) => lower.endsWith(ext.toLowerCase()));
      });
    },
    [acceptExtensions],
  );

  // Tauri file drop handler
  const handleFileDrop = useCallback(
    (_x: number, _y: number, paths: string[]) => {
      setIsDragging(false);
      if (disabled || paths.length === 0) return;

      const valid = filterFiles(paths);
      if (valid.length === 0) {
        toast.error(rejectMessage || `No valid files. Accepted: ${acceptExtensions.join(', ')}`);
        return;
      }

      onFilesDropped(valid);
    },
    [disabled, filterFiles, onFilesDropped, rejectMessage, acceptExtensions],
  );

  // Register/unregister Tauri drag-drop handler
  useEffect(() => {
    if (disabled) return;
    OnFileDrop(handleFileDrop, false);
    return () => {
      OnFileDropOff();
    };
  }, [handleFileDrop, disabled]);

  // HTML5 drag events — visual feedback only
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsDragging(false);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={containerRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      className={cn(
        'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all duration-200',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-muted-foreground/25 hover:border-muted-foreground/40',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="size-10 animate-bounce" />
            <p className="text-sm font-medium">Drop to add</p>
          </div>
        </div>
      )}

      <Icon className="size-10 text-muted-foreground/40" />

      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground/60">or</p>
      </div>

      <Button variant="outline" size="sm" onClick={onBrowse} disabled={disabled}>
        {browseLabel}
      </Button>

      {sublabel && <p className="text-xs text-muted-foreground/50">{sublabel}</p>}
    </div>
  );
}
