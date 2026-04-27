import { useEffect, useState } from 'react';
import { CheckCircle2, Download, FolderOpen, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn, formatDisplayDate, formatFileSize } from '@/lib/utils';
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
          Magisk is the tool that gives your emulator root access. Choose the recommended
          rootAVD-compatible package for automated patching, or pick a local file if you need a
          specific fork for manual mode.
        </p>
      </div>

      {/* Mode toggle */}
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => {
          if (value === 'download' || value === 'local') handleSelectMode(value);
        }}
        className="grid w-full grid-cols-2"
        variant="outline"
      >
        <ToggleGroupItem
          id="root-source-mode-download"
          value="download"
          className="h-auto justify-start gap-2 p-3 text-left"
        >
          <Download />
          <div className="min-w-0">
            <p className="text-sm font-medium">Download</p>
            <p className="text-xs text-muted-foreground">Official stable from GitHub</p>
          </div>
        </ToggleGroupItem>

        <ToggleGroupItem
          id="root-source-mode-local"
          value="local"
          className="h-auto justify-start gap-2 p-3 text-left"
        >
          <FolderOpen />
          <div className="min-w-0">
            <p className="text-sm font-medium">Local File</p>
            <p className="text-xs text-muted-foreground">Pick .apk or .zip</p>
          </div>
        </ToggleGroupItem>
      </ToggleGroup>

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
            <Alert variant="destructive">
              <WifiOff />
              <AlertTitle>Could not reach GitHub</AlertTitle>
              <AlertDescription>{fetchState.message}</AlertDescription>
              <Button
                id="root-source-retry"
                variant="outline"
                size="sm"
                className="w-fit gap-1.5"
                onClick={loadRelease}
              >
                <RefreshCw data-icon="inline-start" />
                Retry
              </Button>
              <p className="text-xs text-muted-foreground">
                No internet? Switch to <strong>Local File</strong> to use a pre-downloaded package.
              </p>
            </Alert>
          )}

          {/* Release card */}
          {fetchState.status === 'ok' && (
            <button
              id="root-source-stable-card"
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                source?.type === 'stable'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40',
              )}
              onClick={() => onSourceChange({ type: 'stable' })}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    Magisk {fetchState.release.tag}
                  </p>
                  <Badge variant="default" className="text-xs">
                    Automated
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fetchState.release.assetName} · {formatFileSize(fetchState.release.size)} ·{' '}
                  {formatDisplayDate(fetchState.release.publishedAt)}
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
            </button>
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
          <Button
            id="root-local-file-picker"
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 border-dashed px-4 py-6 text-center"
            onClick={handleLocalPick}
          >
            <FolderOpen data-icon="inline-start" className="text-muted-foreground" />
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
          </Button>

          <p className="text-xs text-muted-foreground">
            Local packages are best for manual FAKEBOOTIMG mode or when testing a specific Magisk
            fork.
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
