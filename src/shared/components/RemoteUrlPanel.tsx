import { AlertCircle, CheckCircle2, Globe, History, Loader2, Trash2, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/shared/ui/input-group';
import { Switch } from '@/shared/ui/switch';
import { getFileName } from '@/shared/utils/filePath';

const STORAGE_KEY_V1 = 'adb-gui-recent-urls-v1';
const LEGACY_STORAGE_KEY = 'adb-gui-recent-payload-urls';
const MAX_RECENT_URLS = 6;

export type ConnectionStatus = 'idle' | 'checking' | 'ready' | 'error';

export interface RemoteUrlPanelProps {
  connectionStatus: ConnectionStatus;
  disabled?: boolean;
  estimatedSize: string | null;
  onCheckUrl: () => void;
  onLoadPartitions?: () => void;
  onPrefetchChange: (prefetch: boolean) => void;
  onUrlChange: (url: string) => void;
  prefetch: boolean;
  url: string;
}

export function RemoteUrlPanel({
  url,
  onUrlChange,
  prefetch,
  onPrefetchChange,
  connectionStatus,
  estimatedSize,
  onCheckUrl,
  onLoadPartitions,
  disabled = false,
}: RemoteUrlPanelProps) {
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY_V1) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentUrls(
            parsed.filter(
              (item): item is string => typeof item === 'string' && item.trim().length > 0,
            ),
          );
        }
      }
    } catch {
      // Ignore localStorage read errors
    } finally {
      isLoadedRef.current = true;
    }
  }, []);

  const saveRecentUrl = useCallback((newUrl: string) => {
    const trimmed = newUrl.trim();
    if (!(trimmed && trimmed.startsWith('http'))) {
      return;
    }
    setRecentUrls((prev) => {
      const next = [trimmed, ...prev.filter((u) => u !== trimmed)].slice(0, MAX_RECENT_URLS);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isLoadedRef.current) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(recentUrls));
    } catch {
      // Ignore localStorage write errors
    }
  }, [recentUrls]);

  const clearRecentUrls = useCallback(() => {
    setRecentUrls([]);
  }, []);

  const isChecking = connectionStatus === 'checking';
  const isReady = connectionStatus === 'ready';
  const isError = connectionStatus === 'error';
  const hasUrl = url.trim().length > 0;

  const handleActionClick = () => {
    if (hasUrl) {
      saveRecentUrl(url);
    }
    if (isReady && onLoadPartitions) {
      onLoadPartitions();
    } else {
      onCheckUrl();
    }
  };

  const handleSelectRecent = (recentUrl: string) => {
    onUrlChange(recentUrl);
    saveRecentUrl(recentUrl);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* URL Input & Direct Action Header */}
      <FieldGroup>
        <Field>
          <div className="flex items-center justify-between gap-2 pb-1">
            <FieldLabel
              className="flex items-center gap-1.5 font-medium text-body"
              htmlFor="remote-url"
            >
              <Globe aria-hidden="true" className="size-4 text-primary" />
              Payload or Firmware Archive URL
            </FieldLabel>
            <span className="text-caption text-muted-foreground">Direct HTTP/HTTPS stream</span>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <InputGroup className="min-w-0 flex-1">
              <InputGroupInput
                autoComplete="off"
                className="min-w-0 flex-1 text-body"
                disabled={disabled}
                id="remote-url"
                inputMode="url"
                name="remote-payload-url"
                onChange={(e) => onUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hasUrl && !disabled && !isChecking) {
                    e.preventDefault();
                    handleActionClick();
                  }
                }}
                placeholder="https://bigota.d.miui.com/.../ota_full-...zip"
                type="url"
                value={url}
              />
              {url && !disabled ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label="Clear URL"
                    onClick={() => onUrlChange('')}
                    size="icon-xs"
                    type="button"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>

            <Button
              className="h-9 shrink-0 gap-1.5 px-4 font-medium"
              disabled={!hasUrl || isChecking || disabled}
              onClick={handleActionClick}
              size="default"
              type="button"
              variant={isReady ? 'default' : 'secondary'}
            >
              {isChecking ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                  Checking…
                </>
              ) : isReady ? (
                <>
                  <Zap
                    aria-hidden="true"
                    className="size-4 text-amber-300"
                    data-icon="inline-start"
                  />
                  Read Partitions
                </>
              ) : (
                <>
                  <Globe aria-hidden="true" className="size-4" data-icon="inline-start" />
                  Check & Stream
                </>
              )}
            </Button>
          </div>
        </Field>
      </FieldGroup>

      {/* Recent URLs History Strip */}
      {recentUrls.length > 0 && !disabled ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-surface px-2.5 py-1.5 text-[11px]">
          <span className="flex shrink-0 items-center gap-1 font-medium text-muted-foreground">
            <History className="size-3 text-primary" />
            Recent Links:
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {recentUrls.map((recent) => {
              const label = getFileName(recent) || recent.replace(/^https?:\/\//, '').slice(0, 30);
              const isCurrent = recent === url;
              return (
                <button
                  className={`inline-flex max-w-[220px] items-center truncate rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
                    isCurrent
                      ? 'border border-primary/30 bg-primary/15 font-medium text-primary'
                      : 'border border-border/60 bg-surface-raised/80 text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                  }`}
                  key={recent}
                  onClick={() => handleSelectRecent(recent)}
                  title={recent}
                  type="button"
                >
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
          <button
            className="flex shrink-0 items-center gap-0.5 px-1 py-0.5 text-[10px] text-muted-foreground/80 transition-colors hover:text-destructive"
            onClick={clearRecentUrls}
            title="Clear recent links"
            type="button"
          >
            <Trash2 className="size-2.5" />
            Clear
          </button>
        </div>
      ) : null}

      {/* Options & Connection Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-raised/40 px-3 py-2">
        <Field className="m-0 gap-2.5" data-disabled={disabled} orientation="horizontal">
          <Switch
            checked={prefetch}
            disabled={disabled}
            id="prefetch"
            onCheckedChange={onPrefetchChange}
          />
          <FieldContent>
            <FieldLabel className="cursor-pointer font-medium text-caption" htmlFor="prefetch">
              Prefetch mode
            </FieldLabel>
            <FieldDescription className="text-[11px]">
              Download complete archive before extraction
            </FieldDescription>
          </FieldContent>
        </Field>

        {/* Live Range Request Telemetry Chip */}
        <div className="flex items-center gap-2">
          {isChecking ? (
            <div className="flex items-center gap-1.5 text-caption text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Checking HTTP range requests…</span>
            </div>
          ) : isReady ? (
            <div className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2.5 py-1 font-medium text-caption text-success">
              <CheckCircle2 className="size-3.5" />
              <span>Range Requests Verified</span>
              {estimatedSize ? (
                <>
                  <span className="text-success/60">·</span>
                  <Badge
                    className="border-success/30 font-mono text-[10px] text-success"
                    variant="outline"
                  >
                    {estimatedSize}
                  </Badge>
                </>
              ) : null}
            </div>
          ) : isError ? (
            <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-caption text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>Range check failed — enable Prefetch or check URL</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-caption text-muted-foreground">
              <Zap className="size-3 text-amber-400" />
              <span>Zero-download selective partition extraction</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
