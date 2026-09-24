import {
  Archive,
  DownloadCloud,
  FileCode,
  FileUp,
  FolderOpen,
  Layers,
  PackageCheck,
  Smartphone,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { OnFileDrop, OnFileDropOff } from "@/desktop/runtime";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

const ACCEPTED_EXTENSIONS = [".apk", ".apks", ".xapk", ".apkm"];

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
export const InstallDropZone = ({
  className,
  compact = false,
  disabled = false,
  onBrowse,
  onFilesDropped,
  selectedSerial,
}: InstallDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const validateAndHandlePaths = useCallback(
    (paths: string[]) => {
      const valid = paths.filter((p) => {
        const lower = p.toLowerCase();
        return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
      });

      if (valid.length === 0) {
        toast.error("Unsupported package format. Drop .apk, .apks, .xapk, or .apkm files.");
        return;
      }

      onFilesDropped(valid);
    },
    [onFilesDropped]
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

    const files = [...e.dataTransfer.files];
    const paths: string[] = [];

    for (const f of files) {
      const p = "path" in f && typeof f.path === "string" ? f.path : f.name;
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
          // oxlint-disable-next-line shadcn/no-arbitrary-values -- scoped transition properties avoid forbidden transition:all
          "group relative flex items-center justify-between gap-3 rounded-lg border-2 border-dashed px-4 py-2.5 transition-[color,background-color,border-color,box-shadow] duration-200 select-none",
          isDragOver
            ? "border-primary bg-primary/10 ring-primary/20 ring-2"
            : "border-border/80 bg-surface/60 hover:border-border-control hover:bg-surface-raised/40",
          disabled && "pointer-events-none opacity-60",
          className
        )}
        onDragLeave={handleHtmlDragLeave}
        onDragOver={handleHtmlDragOver}
        onDrop={handleHtmlDrop}
        ref={dropZoneRef}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-200",
              isDragOver
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface-raised text-muted-foreground group-hover:text-primary"
            )}
          >
            <FileUp className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-body text-foreground truncate font-medium">
              {isDragOver
                ? "Drop files to add to queue"
                : "Drag & drop more .apk, .apks, .xapk, or .apkm files here"}
            </span>
            <span className="text-caption text-muted-foreground">
              Files are automatically inspected before sideloading
            </span>
          </div>
        </div>

        <Button
          className="text-caption h-7 shrink-0 gap-1.5 px-2.5 font-medium"
          disabled={disabled}
          onClick={onBrowse}
          size="sm"
          type="button"
          variant="outline"
        >
          <FolderOpen aria-hidden="true" className="size-3.5" data-icon="inline-start" />
          <span>Browse More</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // oxlint-disable-next-line shadcn/no-arbitrary-values -- scoped transition properties avoid forbidden transition:all
        "group relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6 text-center transition-[border-color,background-color,box-shadow] duration-200 select-none",
        isDragOver
          ? "border-primary bg-primary/5 ring-primary/10 ring-4"
          : "border-border/80 bg-surface/70 hover:border-border-control hover:bg-surface-raised/40",
        disabled && "pointer-events-none opacity-60",
        className
      )}
      onDragLeave={handleHtmlDragLeave}
      onDragOver={handleHtmlDragOver}
      onDrop={handleHtmlDrop}
      ref={dropZoneRef}
    >
      {/* Central Illuminated Icon Module */}
      <div
        className={cn(
          // oxlint-disable-next-line shadcn/no-arbitrary-values -- scoped transition properties avoid forbidden transition:all
          "flex size-14 items-center justify-center rounded-2xl border transition-[color,background-color,border-color,box-shadow,transform] duration-300",
          isDragOver
            ? "border-primary bg-primary text-primary-foreground shadow-primary/20 scale-110 shadow-lg"
            : "border-border bg-surface-raised text-muted-foreground group-hover:border-border-control group-hover:text-foreground group-hover:scale-105"
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
        <h3 className="text-foreground text-title font-semibold tracking-tight">
          {isDragOver ? "Release to queue packages for install" : "Drag & Drop Android Packages"}
        </h3>
        <p className="text-body text-muted-foreground max-w-md leading-relaxed">
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
          <FolderOpen aria-hidden="true" className="size-4" data-icon="inline-start" />
          Select Package Files
        </Button>
      </div>

      {/* Supported Package Container Formats Pill Band */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
        <Badge className="text-caption gap-1 px-2 py-1" variant="secondary">
          <PackageCheck aria-hidden="true" className="text-success size-3.5" />
          <span className="font-mono font-bold">.APK</span>
          <span className="text-muted-foreground">Standalone</span>
        </Badge>

        <Badge className="text-caption gap-1 px-2 py-1" variant="secondary">
          <Layers aria-hidden="true" className="text-info size-3.5" />
          <span className="font-mono font-bold">.APKS</span>
          <span className="text-muted-foreground">Split Bundle</span>
        </Badge>

        <Badge className="text-caption gap-1 px-2 py-1" variant="secondary">
          <Archive aria-hidden="true" className="text-warning size-3.5" />
          <span className="font-mono font-bold">.XAPK</span>
          <span className="text-muted-foreground">OBB Archive</span>
        </Badge>

        <Badge className="text-caption gap-1 px-2 py-1" variant="secondary">
          <FileCode aria-hidden="true" className="text-info size-3.5" />
          <span className="font-mono font-bold">.APKM</span>
          <span className="text-muted-foreground">APKMirror</span>
        </Badge>
      </div>

      {/* Device advisory footer note */}
      {selectedSerial ? null : (
        <Alert className="border-warning/30 bg-warning-muted text-warning mt-1" variant="default">
          <Smartphone aria-hidden="true" className="size-3.5" />
          <AlertTitle className="text-caption">No device selected</AlertTitle>
          <AlertDescription className="text-caption">
            You can still queue and inspect packages now; installation activates when a device
            connects.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
