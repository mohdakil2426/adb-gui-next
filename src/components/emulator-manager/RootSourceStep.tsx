import { useEffect, useState } from 'react';
import { CheckCircle2, Download, FolderOpen, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { backend } from '@/lib/desktop/models';
import { FetchMagiskStableRelease, SelectRootPackageFile } from '@/lib/desktop/backend';
import type { RootWizardSource } from '@/lib/emulatorManagerStore';

interface RootSourceStepProps {
  source: RootWizardSource;
  onSourceChange: (source: RootWizardSource) => void;
  onContinue: () => void;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'ok'; release: backend.MagiskStableRelease }
  | { status: 'error'; message: string };

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function RootSourceStep({ source, onSourceChange, onContinue }: RootSourceStepProps) {
  const [mode, setMode] = useState<'download' | 'local'>(
    source?.type === 'local' ? 'local' : 'download',
  );
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'loading' });

  function loadRelease() {
    setFetchState({ status: 'loading' });
    FetchMagiskStableRelease()
      .then((release) => {
        setFetchState({ status: 'ok', release });
        if (!source || source.type !== 'local') {
          onSourceChange({ type: 'stable' });
        }
      })
      .catch((err: unknown) => {
        setFetchState({ status: 'error', message: String(err) });
      });
  }

  // Fetch once on mount — source/onSourceChange are only needed at mount-time for the
  // initial auto-select, so the empty dep array is intentional here.
  useEffect(() => {
    loadRelease();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLocalPick() {
    const path = await SelectRootPackageFile();
    if (!path) return;
    onSourceChange({ type: 'local', path });
  }

  function handleSelectMode(next: 'download' | 'local') {
    setMode(next);
    if (next === 'download') {
      // Switch back to stable source when toggling back to download mode.
      if (fetchState.status === 'ok') {
        onSourceChange({ type: 'stable' });
      }
    }
  }

  const canContinue =
    source !== null &&
    (source.type === 'local' || (source.type === 'stable' && fetchState.status === 'ok'));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">Select Magisk Source</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Download the official stable release, or pick any local package — Kitsune Mask, Magisk
          Delta, Alpha, Canary, and more are all supported via local file.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          id="root-source-mode-download"
          className={cn(
            'flex flex-1 items-center gap-2 rounded-lg border p-3 text-left transition-colors',
            mode === 'download'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50',
          )}
          onClick={() => handleSelectMode('download')}
        >
          <Download className="size-4 shrink-0" />
          <div>
            <p className="text-sm font-medium">Download</p>
            <p className="text-xs text-muted-foreground">Official stable from GitHub</p>
          </div>
        </button>

        <button
          id="root-source-mode-local"
          className={cn(
            'flex flex-1 items-center gap-2 rounded-lg border p-3 text-left transition-colors',
            mode === 'local'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50',
          )}
          onClick={() => handleSelectMode('local')}
        >
          <FolderOpen className="size-4 shrink-0" />
          <div>
            <p className="text-sm font-medium">Local File</p>
            <p className="text-xs text-muted-foreground">Pick .apk or .zip</p>
          </div>
        </button>
      </div>

      {/* Download panel */}
      {mode === 'download' && (
        <div className="flex flex-col gap-3">
          {/* Loading */}
          {fetchState.status === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Fetching latest stable release…
            </div>
          )}

          {/* Error */}
          {fetchState.status === 'error' && (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <WifiOff className="mt-0.5 size-4 shrink-0" />
                <span>Could not reach GitHub: {fetchState.message}</span>
              </div>
              <Button
                id="root-source-retry"
                variant="outline"
                size="sm"
                className="w-fit gap-1.5"
                onClick={loadRelease}
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
              <p className="text-xs text-muted-foreground">
                No internet? Switch to <strong>Local File</strong> to use a pre-downloaded package.
              </p>
            </div>
          )}

          {/* Release card */}
          {fetchState.status === 'ok' && (
            <div
              id="root-source-stable-card"
              className={cn(
                'flex items-center justify-between rounded-lg border px-4 py-3 transition-colors',
                source?.type === 'stable'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40',
              )}
              role="button"
              onClick={() => onSourceChange({ type: 'stable' })}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    Magisk {fetchState.release.tag}
                  </p>
                  <Badge variant="default" className="text-xs">
                    Stable
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fetchState.release.assetName} · {formatBytes(fetchState.release.size)} ·{' '}
                  {formatDate(fetchState.release.publishedAt)}
                </p>
                {fetchState.release.sha256 && (
                  <p
                    className="mt-0.5 max-w-xs truncate font-mono text-[10px] text-muted-foreground/60"
                    title={`sha256: ${fetchState.release.sha256}`}
                  >
                    sha256: {fetchState.release.sha256.slice(0, 16)}…
                  </p>
                )}
              </div>

              {source?.type === 'stable' && (
                <CheckCircle2 className="size-5 shrink-0 text-primary" />
              )}
            </div>
          )}

          {fetchState.status === 'ok' && (
            <p className="text-xs text-muted-foreground">
              The APK will be downloaded automatically when you proceed. Already cached packages are
              reused.
            </p>
          )}
        </div>
      )}

      {/* Local file panel */}
      {mode === 'local' && (
        <div className="flex flex-col gap-3">
          <button
            id="root-local-file-picker"
            className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-center transition-colors hover:border-primary/60"
            onClick={handleLocalPick}
          >
            <FolderOpen className="size-5 shrink-0 text-muted-foreground" />
            <div className="text-left">
              {source?.type === 'local' ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    {source.path.split(/[/\\]/).pop()}
                  </p>
                  <p className="max-w-xs truncate text-xs text-muted-foreground">{source.path}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Click to select a file</p>
                  <p className="text-xs text-muted-foreground">Supports .apk and .zip packages</p>
                </>
              )}
            </div>
          </button>

          <p className="text-xs text-muted-foreground">
            Any Magisk fork is supported: official Magisk, Kitsune Mask, Magisk Delta, Alpha,
            Canary, and more.
          </p>
        </div>
      )}

      <Button
        id="root-source-continue"
        className="w-full"
        disabled={!canContinue}
        onClick={onContinue}
      >
        Continue
      </Button>
    </div>
  );
}
