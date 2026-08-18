import {
  Archive,
  DownloadCloud,
  FileCode,
  FileUp,
  FolderOpen,
  Layers,
  PackageCheck,
  Smartphone,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { OnFileDrop, OnFileDropOff } from '@/desktop/runtime';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

const ACCEPTED_EXTENSIONS = ['.apk', '.apks', '.xapk', '.apkm'];

interface InstallDropZoneProps {
  className?: string | undefined;
  compact?: boolean | undefined;
  disabled?: boolean | undefined;
  onBrowse: () => void;
  onFilesDropped: (paths: string[]) => void;
  selectedSerial: string | null;
}

/**
 * Precision Hardware Cockpit Drag & Drop Zone for Android Packages.
 * Supports .apk, .apks, .xapk, and .apkm bundles with continuous drop capabilities.
 */
export function InstallDropZone({
  className,
  compact = false,
  disabled = false,
  onBrowse,
  onFilesDropped,
  selectedSerial,
}: InstallDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const validateAndHandlePaths = useCallback(
    (paths: string[]) => {
      const valid = paths.filter((p) => {
        const lower = p.toLowerCase();
        return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
      });

      if (valid.length === 0) {
        toast.error('Unsupported package format. Drop .apk, .apks, .xapk, or .apkm files.');
        return;
      }

      onFilesDropped(valid);
    },
    [onFilesDropped],
  );

  // Tauri window drag-and-drop listener
  useEffect(() => {
    if (disabled) {
      return;
    }

    OnFileDrop({
      onDrop: (paths) => {
        validateAndHandlePaths(paths);
        setIsDragOver(false);
      },
    });

    return () => {
      OnFileDropOff();
    };
  }, [disabled, validateAndHandlePaths]);

  // Standard HTML5 drag-and-drop fallback
  const handleHtmlDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleHtmlDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleHtmlDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) {
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const paths: string[] = [];

    for (const f of files) {
      const p = 'path' in f && typeof f.path === 'string' ? f.path : f.name;
      if (p) {
        paths.push(p);
      }
    }

    validateAndHandlePaths(paths);
  };

  if (compact) {
    return (
      <div
        className={cn(
          'group relative flex select-none items-center justify-between gap-3 rounded-lg border-2 border-dashed px-4 py-2.5 transition-all duration-200',
          isDragOver
            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
            : 'border-border/80 bg-surface/60 hover:border-border-control hover:bg-surface-raised/40',
          disabled && 'pointer-events-none opacity-60',
          className,
        )}
        onDragLeave={handleHtmlDragLeave}
        onDragOver={handleHtmlDragOver}
        onDrop={handleHtmlDrop}
        ref={dropZoneRef}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md border transition-all duration-200',
              isDragOver
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface-raised text-muted-foreground group-hover:text-primary',
            )}
          >
            <FileUp className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-body text-foreground">
              {isDragOver
                ? 'Drop files to add to queue'
                : 'Drag & drop more .apk, .apks, .xapk, or .apkm files here'}
            </span>
            <span className="text-caption text-muted-foreground">
              Files are automatically inspected before sideloading
            </span>
          </div>
        </div>

        <Button
          className="h-7 shrink-0 gap-1.5 px-2.5 font-medium text-caption"
          disabled={disabled}
          onClick={onBrowse}
          size="sm"
          type="button"
          variant="outline"
        >
          <FolderOpen aria-hidden="true" className="size-3.5" />
          <span>Browse More</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex select-none flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200',
        isDragOver
          ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
          : 'border-border/80 bg-surface/70 hover:border-border-control hover:bg-surface-raised/40',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
      onDragLeave={handleHtmlDragLeave}
      onDragOver={handleHtmlDragOver}
      onDrop={handleHtmlDrop}
      ref={dropZoneRef}
    >
      {/* Central Illuminated Icon Module */}
      <div
        className={cn(
          'flex size-14 items-center justify-center rounded-2xl border transition-all duration-300',
          isDragOver
            ? 'scale-110 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
            : 'border-border bg-surface-raised text-muted-foreground group-hover:scale-105 group-hover:border-border-control group-hover:text-foreground',
        )}
      >
        {isDragOver ? (
          <DownloadCloud aria-hidden="true" className="size-7 animate-bounce" />
        ) : (
          <FileUp aria-hidden="true" className="size-7" />
        )}
      </div>

      {/* Main Callout text */}
      <div className="flex flex-col items-center gap-1">
        <h3 className="font-semibold text-foreground text-title tracking-tight">
          {isDragOver ? 'Release to queue packages for install' : 'Drag & Drop Android Packages'}
        </h3>
        <p className="max-w-md text-body text-muted-foreground leading-relaxed">
          Drop application binaries or bundles directly into this cockpit, or browse files on your
          computer.
        </p>
      </div>

      {/* Action Button */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          className="h-9 gap-2 px-4 font-medium"
          disabled={disabled}
          onClick={onBrowse}
          size="default"
          type="button"
        >
          <FolderOpen aria-hidden="true" className="size-4" />
          Select Package Files
        </Button>
      </div>

      {/* Supported Package Container Formats Pill Band */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
        <div className="flex items-center gap-1 rounded-md border border-border/80 bg-surface-raised/60 px-2 py-1 text-caption text-foreground">
          <PackageCheck aria-hidden="true" className="size-3.5 text-emerald-500" />
          <span className="font-bold font-mono">.APK</span>
          <span className="text-muted-foreground">Standalone</span>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border/80 bg-surface-raised/60 px-2 py-1 text-caption text-foreground">
          <Layers aria-hidden="true" className="size-3.5 text-sky-500" />
          <span className="font-bold font-mono">.APKS</span>
          <span className="text-muted-foreground">Split Bundle</span>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border/80 bg-surface-raised/60 px-2 py-1 text-caption text-foreground">
          <Archive aria-hidden="true" className="size-3.5 text-amber-500" />
          <span className="font-bold font-mono">.XAPK</span>
          <span className="text-muted-foreground">OBB Archive</span>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border/80 bg-surface-raised/60 px-2 py-1 text-caption text-foreground">
          <FileCode aria-hidden="true" className="size-3.5 text-purple-500" />
          <span className="font-bold font-mono">.APKM</span>
          <span className="text-muted-foreground">APKMirror</span>
        </div>
      </div>

      {/* Device advisory footer note */}
      {selectedSerial ? null : (
        <div className="mt-1 flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-amber-500 text-caption dark:text-amber-400">
          <Smartphone aria-hidden="true" className="size-3.5 shrink-0" />
          <span>
            No device selected in sidebar. You can still queue and inspect packages now;
            installation activates when a device connects.
          </span>
        </div>
      )}
    </div>
  );
}
