import { Download, Loader2, RotateCcw, Square, Trash2, X, Zap, ZapOff } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

interface InstalledBatchBarProps {
  isUninstalling?: boolean;
  onBatchClearCache?: () => void;
  onBatchDisable?: () => void;
  onBatchEnable?: () => void;
  onBatchExportApk?: () => void;
  onBatchForceStop?: () => void;
  onBatchUninstall: () => void;
  onClearSelection: () => void;
  selectedCount: number;
}

/** Precision Floating Multi-Selection Batch Actions Bar. */
export function InstalledBatchBar({
  isUninstalling = false,
  onBatchClearCache,
  onBatchDisable,
  onBatchEnable,
  onBatchExportApk,
  onBatchForceStop,
  onBatchUninstall,
  onClearSelection,
  selectedCount,
}: InstalledBatchBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fade-in slide-in-from-bottom-2 sticky bottom-0 z-30 flex animate-in flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/95 px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all duration-150">
      {/* Selected Items Counter */}
      <div className="flex items-center gap-2.5">
        <Badge className="numeric px-2 py-0.5 font-mono text-caption" variant="default">
          {selectedCount}
        </Badge>
        <span className="font-medium text-body text-foreground">
          {selectedCount === 1 ? '1 package selected' : `${selectedCount} packages selected`}
        </span>
        <Button
          aria-label="Clear selection"
          className="size-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={onClearSelection}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* 1-Click Hardware Batch Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {onBatchEnable ? (
          <Button
            className="h-8 gap-1.5 border-border/80 font-medium text-caption text-emerald-600 hover:bg-accent dark:text-emerald-400"
            disabled={isUninstalling}
            onClick={onBatchEnable}
            size="sm"
            type="button"
            variant="outline"
          >
            <Zap className="size-3.5 fill-current" />
            <span>Enable Selected</span>
          </Button>
        ) : null}

        {onBatchDisable ? (
          <Button
            className="h-8 gap-1.5 border-border/80 font-medium text-amber-600 text-caption hover:bg-accent dark:text-amber-400"
            disabled={isUninstalling}
            onClick={onBatchDisable}
            size="sm"
            type="button"
            variant="outline"
          >
            <ZapOff className="size-3.5" />
            <span>Disable Selected</span>
          </Button>
        ) : null}

        {onBatchExportApk ? (
          <Button
            className="h-8 gap-1.5 border-border/80 font-medium text-caption hover:bg-accent"
            disabled={isUninstalling}
            onClick={onBatchExportApk}
            size="sm"
            type="button"
            variant="outline"
          >
            <Download className="size-3.5 text-primary" />
            <span>Export APKs</span>
          </Button>
        ) : null}

        {onBatchClearCache ? (
          <Button
            className="h-8 gap-1.5 border-border/80 font-medium text-caption text-sky-600 hover:bg-accent dark:text-sky-400"
            disabled={isUninstalling}
            onClick={onBatchClearCache}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw className="size-3.5" />
            <span>Clear Cache</span>
          </Button>
        ) : null}

        {onBatchForceStop ? (
          <Button
            className="h-8 gap-1.5 border-border/80 font-medium text-amber-600 text-caption hover:bg-accent dark:text-amber-400"
            disabled={isUninstalling}
            onClick={onBatchForceStop}
            size="sm"
            type="button"
            variant="outline"
          >
            <Square className="size-3.5 fill-current" />
            <span>Force Stop</span>
          </Button>
        ) : null}

        <Button
          className="h-8 gap-1.5 font-medium text-caption shadow-xs"
          disabled={isUninstalling}
          onClick={onBatchUninstall}
          size="sm"
          type="button"
          variant="destructive"
        >
          {isUninstalling ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
          <span>Uninstall ({selectedCount})</span>
        </Button>
      </div>
    </div>
  );
}
