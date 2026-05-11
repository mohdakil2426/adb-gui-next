import {
  CheckCircle2,
  Download,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FetchMagiskStableRelease,
  SelectRootPackageFile,
} from "@/lib/desktop/backend";
import type { backend } from "@/lib/desktop/models";
import type { RootWizardSource } from "@/lib/emulatorManagerStore";
import { cn, formatDisplayDate, formatFileSize } from "@/lib/utils";

interface RootSourceStepProps {
  onContinue: () => void;
  onManualMode: () => void;
  onSourceChange: (source: RootWizardSource) => void;
  source: RootWizardSource;
}

type FetchState =
  | { status: "loading" }
  | { status: "ok"; release: backend.MagiskStableRelease }
  | { status: "error"; message: string };

export function RootSourceStep({
  source,
  onSourceChange,
  onContinue,
  onManualMode,
}: RootSourceStepProps) {
  const [mode, setMode] = useState<"download" | "local">(
    source?.type === "local" ? "local" : "download"
  );
  const [fetchState, setFetchState] = useState<FetchState>({
    status: "loading",
  });

  function loadRelease() {
    setFetchState({ status: "loading" });
    FetchMagiskStableRelease()
      .then((release) => {
        setFetchState({ status: "ok", release });
        if (source?.type !== "local") {
          onSourceChange({ type: "stable" });
        }
      })
      .catch((err: unknown) => {
        setFetchState({ status: "error", message: String(err) });
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
    if (!path) {
      return;
    }
    onSourceChange({ type: "local", path });
  }

  function handleSelectMode(next: "download" | "local") {
    setMode(next);
    if (next === "download") {
      // Switch back to stable source when toggling back to download mode.
      if (fetchState.status === "ok") {
        onSourceChange({ type: "stable" });
      }
    }
  }

  const canContinue =
    source !== null &&
    (source.type === "local" ||
      (source.type === "stable" && fetchState.status === "ok"));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-semibold text-base text-foreground">
          Select Magisk Source
        </h3>
        <p className="mt-1 text-muted-foreground text-sm">
          Magisk is the tool that gives your emulator root access. Choose the
          recommended rootAVD-compatible package for automated patching, or pick
          a local file if you need a specific fork for manual mode.
        </p>
      </div>

      {/* Mode toggle */}
      <ToggleGroup
        className="grid w-full grid-cols-2"
        onValueChange={(value) => {
          if (value === "download" || value === "local") {
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
          <Download />
          <div className="min-w-0">
            <p className="font-medium text-sm">Download</p>
            <p className="text-muted-foreground text-xs">
              Official stable from GitHub
            </p>
          </div>
        </ToggleGroupItem>

        <ToggleGroupItem
          className="h-auto justify-start gap-2 p-3 text-left"
          id="root-source-mode-local"
          value="local"
        >
          <FolderOpen />
          <div className="min-w-0">
            <p className="font-medium text-sm">Local File</p>
            <p className="text-muted-foreground text-xs">Pick .apk or .zip</p>
          </div>
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Download panel */}
      {mode === "download" && (
        <div className="flex flex-col gap-3">
          {/* Loading */}
          {fetchState.status === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Fetching latest stable release…
            </div>
          )}

          {/* Error */}
          {fetchState.status === "error" && (
            <Alert variant="destructive">
              <WifiOff />
              <AlertTitle>Could not reach GitHub</AlertTitle>
              <AlertDescription>{fetchState.message}</AlertDescription>
              <Button
                className="w-fit gap-1.5"
                id="root-source-retry"
                onClick={loadRelease}
                size="sm"
                variant="outline"
              >
                <RefreshCw data-icon="inline-start" />
                Retry
              </Button>
              <p className="text-muted-foreground text-xs">
                No internet? Switch to <strong>Local File</strong> to use a
                pre-downloaded package.
              </p>
            </Alert>
          )}

          {/* Release card */}
          {fetchState.status === "ok" && (
            <button
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                source?.type === "stable"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40"
              )}
              id="root-source-stable-card"
              onClick={() => {
                onSourceChange({ type: "stable" });
              }}
              type="button"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground text-sm">
                    Magisk {fetchState.release.tag}
                  </p>
                  <Badge className="text-xs" variant="default">
                    Automated
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {fetchState.release.assetName} ·{" "}
                  {formatFileSize(fetchState.release.size)} ·{" "}
                  {formatDisplayDate(fetchState.release.publishedAt)}
                </p>
                {fetchState.release.sha256 ? (
                  <p
                    className="mt-0.5 max-w-xs truncate font-mono text-[10px] text-muted-foreground/60"
                    title={`sha256: ${fetchState.release.sha256}`}
                  >
                    sha256: {fetchState.release.sha256.slice(0, 16)}…
                  </p>
                ) : null}
              </div>

              {source?.type === "stable" && (
                <CheckCircle2 className="size-5 shrink-0 text-primary" />
              )}
            </button>
          )}

          {fetchState.status === "ok" && (
            <p className="text-muted-foreground text-xs">
              The APK will be downloaded automatically when you proceed. Already
              cached packages are reused.
            </p>
          )}
        </div>
      )}

      {/* Local file panel */}
      {mode === "local" && (
        <div className="flex flex-col gap-3">
          <Button
            className="h-auto justify-start gap-3 border-dashed px-4 py-6 text-center"
            id="root-local-file-picker"
            onClick={handleLocalPick}
            type="button"
            variant="outline"
          >
            <FolderOpen
              className="text-muted-foreground"
              data-icon="inline-start"
            />
            <div className="text-left">
              {source?.type === "local" ? (
                <>
                  <p className="font-medium text-foreground text-sm">
                    {source.path.split(/[/\\]/).pop()}
                  </p>
                  <p className="max-w-xs truncate text-muted-foreground text-xs">
                    {source.path}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground text-sm">
                    Click to select a file
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Supports .apk and .zip packages
                  </p>
                </>
              )}
            </div>
          </Button>

          <p className="text-muted-foreground text-xs">
            Local packages are best for manual FAKEBOOTIMG mode or when testing
            a specific Magisk fork.
          </p>
        </div>
      )}

      <Button
        className="w-full"
        disabled={!canContinue}
        id="root-source-continue"
        onClick={onContinue}
      >
        Continue
      </Button>

      <div className="flex flex-col gap-2 border-t pt-4">
        <Button
          className="w-full gap-2"
          id="root-source-manual-mode"
          onClick={onManualMode}
          type="button"
          variant="outline"
        >
          <ShieldCheck data-icon="inline-start" />
          Manual Mode (FAKEBOOTIMG)
        </Button>
        <p className="text-center text-muted-foreground text-xs">
          Use this when automated ramdisk patching fails or when you want Magisk
          inside the emulator to patch the fake boot image itself.
        </p>
      </div>
    </div>
  );
}
