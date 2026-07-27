import {
  CircleCheck,
  Download,
  FolderOpen,
  Loader2,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { FetchMagiskStableRelease, SelectRootPackageFile } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import type { RootWizardSource } from '@/features/emulator/model/emulatorManagerStore';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { cn } from '@/shared/utils/cn';
import { formatBytes, formatDisplayDate } from '@/shared/utils/format';

interface RootSourceStepProps {
  onContinue: () => void;
  /** Must be referentially stable — it is an effect dependency. */
  onSourceChange: (source: RootWizardSource) => void;
  source: RootWizardSource;
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
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFetchState({ status: 'loading' });
    FetchMagiskStableRelease()
      .then((release) => {
        if (!cancelled) {
          setFetchState({ status: 'ok', release });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchState({ status: 'error', message: String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Pre-select the fetched release when nothing is chosen yet. Split out of the
  // fetch so neither needs a dependency suppression.
  useEffect(() => {
    if (fetchState.status === 'ok' && source === null) {
      onSourceChange({ type: 'stable' });
    }
  }, [fetchState.status, onSourceChange, source]);

  async function handleLocalPick() {
    const path = await SelectRootPackageFile();
    if (!path) {
      return;
    }
    onSourceChange({ type: 'local', path });
  }

  function handleSelectMode(next: 'download' | 'local') {
    setMode(next);
    // Switch back to the stable source when toggling back to download mode.
    if (next === 'download' && fetchState.status === 'ok') {
      onSourceChange({ type: 'stable' });
    }
  }

  const canContinue =
    source !== null &&
    (source.type === 'local' || (source.type === 'stable' && fetchState.status === 'ok'));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-title">Select Magisk source (Autopilot)</h3>
        <p className="mt-0.5 text-body text-muted-foreground">
          Magisk is what gives the emulator root access. Autopilot patches the boot image for you.
        </p>
      </div>

      <Alert className="border-warning/30 bg-warning-muted">
        <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
        <AlertTitle>Autopilot needs Magisk v25.2 or older</AlertTitle>
        <AlertDescription>
          Newer Magisk releases (v26 and above) changed their internal layout and cannot be patched
          automatically. For those, switch to the Manual FAKEBOOTIMG tab above.
        </AlertDescription>
      </Alert>

      <ToggleGroup
        className="grid w-full grid-cols-2"
        onValueChange={(value) => {
          if (value === 'download' || value === 'local') {
            handleSelectMode(value);
          }
        }}
        type="single"
        value={mode}
        variant="outline"
      >
        <ToggleGroupItem
          className="h-auto justify-start gap-2 p-3 text-left"
          id="root-source-mode-download"
          value="download"
        >
          <Download aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-medium text-body">Download</span>
            <span className="block text-caption text-muted-foreground">
              Official stable from GitHub
            </span>
          </span>
        </ToggleGroupItem>

        <ToggleGroupItem
          className="h-auto justify-start gap-2 p-3 text-left"
          id="root-source-mode-local"
          value="local"
        >
          <FolderOpen aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-medium text-body">Local file</span>
            <span className="block text-caption text-muted-foreground">Pick an .apk or .zip</span>
          </span>
        </ToggleGroupItem>
      </ToggleGroup>

      {mode === 'download' && (
        <div className="flex flex-col gap-3">
          {fetchState.status === 'loading' && (
            <output className="flex items-center gap-2 text-body text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Fetching the latest stable release…
            </output>
          )}

          {fetchState.status === 'error' && (
            <Alert variant="destructive">
              <WifiOff aria-hidden="true" />
              <AlertTitle>Could not reach GitHub</AlertTitle>
              <AlertDescription>
                {fetchState.message}. Retry, or switch to Local file and use a package you already
                downloaded.
              </AlertDescription>
              <Button
                className="w-fit"
                id="root-source-retry"
                onClick={() => {
                  setReloadToken((token) => token + 1);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" />
                Retry
              </Button>
            </Alert>
          )}

          {fetchState.status === 'ok' && (
            <>
              <button
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors duration-90 ease-standard',
                  source?.type === 'stable'
                    ? 'border-primary bg-primary-muted'
                    : 'border-border bg-surface-raised hover:border-border-strong',
                )}
                id="root-source-stable-card"
                onClick={() => {
                  onSourceChange({ type: 'stable' });
                }}
                type="button"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-body text-foreground">
                      Magisk {fetchState.release.tag}
                    </span>
                    <Badge variant="info">Automated</Badge>
                  </span>
                  <span className="numeric truncate text-caption text-muted-foreground">
                    {fetchState.release.assetName} · {formatBytes(fetchState.release.size)} ·{' '}
                    {formatDisplayDate(fetchState.release.publishedAt)}
                  </span>
                  {fetchState.release.sha256 ? (
                    <span className="truncate font-mono text-mono-sm text-muted-foreground">
                      sha256 {fetchState.release.sha256.slice(0, 16)}…
                    </span>
                  ) : null}
                </span>

                {source?.type === 'stable' ? (
                  <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
                ) : null}
              </button>
              <p className="text-caption text-muted-foreground">
                The package downloads when you continue. An already-cached copy is reused.
              </p>
            </>
          )}
        </div>
      )}

      {mode === 'local' && (
        <div className="flex flex-col gap-3">
          <Button
            className="h-auto justify-start gap-3 border-dashed px-3 py-5"
            id="root-local-file-picker"
            onClick={() => {
              void handleLocalPick();
            }}
            type="button"
            variant="outline"
          >
            <FolderOpen aria-hidden="true" className="text-muted-foreground" />
            <span className="min-w-0 text-left">
              {source?.type === 'local' ? (
                <>
                  <span className="block font-medium text-body text-foreground">
                    {source.path.split(/[/\\]/).pop()}
                  </span>
                  <span className="block truncate font-mono text-mono-sm text-muted-foreground">
                    {source.path}
                  </span>
                </>
              ) : (
                <>
                  <span className="block font-medium text-body text-foreground">
                    Click to select a file
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    Supports .apk and .zip packages
                  </span>
                </>
              )}
            </span>
          </Button>

          <p className="text-caption text-muted-foreground">
            Use a local package for Manual FAKEBOOTIMG mode, or when testing a specific Magisk fork.
          </p>
        </div>
      )}

      <Button
        className="w-full"
        disabled={!canContinue}
        id="root-source-continue"
        onClick={onContinue}
        size="sm"
        type="button"
      >
        Start Automated Root
      </Button>
    </div>
  );
}
