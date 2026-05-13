import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DropZone } from '@/components/DropZone';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FinalizeAvdRoot,
  PrepareAvdRoot,
  SelectPatchedRootImageFile,
  SelectRootPackageFile,
} from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';

interface RootManualStepProps {
  avdName: string;
  onBack: () => void;
  onColdBoot: () => void;
  serial: string | null;
}

export function RootManualStep({ avdName, serial, onBack, onColdBoot }: RootManualStepProps) {
  const [packagePath, setPackagePath] = useState<string | null>(null);
  const [patchedImagePath, setPatchedImagePath] = useState<string | null>(null);
  const [prepareResult, setPrepareResult] = useState<backend.RootPreparationResult | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<backend.RootFinalizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  async function handleChoosePackage() {
    const path = await SelectRootPackageFile();
    if (!path) {
      return;
    }
    setPackagePath(path);
    setPatchedImagePath(null);
    setPrepareResult(null);
    setFinalizeResult(null);
    setError(null);
  }

  async function handleChoosePatchedImage() {
    const path = await SelectPatchedRootImageFile();
    if (!path) {
      return;
    }
    setPatchedImagePath(path);
    setFinalizeResult(null);
    setError(null);
  }

  async function handlePrepare() {
    if (!(serial && packagePath)) {
      return;
    }

    setIsPreparing(true);
    setError(null);
    try {
      const result = await PrepareAvdRoot({
        avdName,
        serial,
        rootPackagePath: packagePath,
      });
      setPrepareResult(result);
      setPatchedImagePath(null);
      setFinalizeResult(null);
      toast.success('fakeboot.img created and Magisk launched');
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleFinalize() {
    if (!(serial || patchedImagePath)) {
      return;
    }

    setIsFinalizing(true);
    setError(null);
    try {
      const result = await FinalizeAvdRoot({
        avdName,
        serial,
        ...(patchedImagePath ? { patchedImagePath } : {}),
      });
      setFinalizeResult(result);
      toast.success('Manual patch installed');
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsFinalizing(false);
    }
  }

  const packageName = packagePath?.split(/[/\\]/).pop() ?? null;
  const patchedImageName = patchedImagePath?.split(/[/\\]/).pop() ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base text-foreground">Manual Mode (FAKEBOOTIMG)</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            Create a temporary fake boot image, patch it in Magisk inside the emulator, then install
            the patched output back into the AVD ramdisk.
          </p>
        </div>
        <Badge variant="secondary">Fallback</Badge>
      </div>

      {!serial && (
        <Alert variant="destructive">
          <ShieldCheck />
          <AlertTitle>Emulator is not online</AlertTitle>
          <AlertDescription>
            Launch the AVD and wait until ADB shows it as online before creating fakeboot.img.
          </AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive">
          <ShieldCheck />
          <AlertTitle>Manual root failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <Button
          className="h-auto justify-start gap-3 border-dashed px-4 py-5 text-left"
          id="root-manual-pick-package"
          onClick={handleChoosePackage}
          type="button"
          variant="outline"
        >
          <FolderOpen className="text-muted-foreground" data-icon="inline-start" />
          <span className="min-w-0">
            <span className="block font-medium text-sm">
              {packageName ?? 'Choose Magisk Package'}
            </span>
            <span className="block truncate text-muted-foreground text-xs">
              {packagePath ?? 'Supports .apk and .zip packages'}
            </span>
          </span>
        </Button>

        <Button
          className="gap-2"
          disabled={!(serial && packagePath) || isPreparing}
          id="root-manual-create-fakeboot"
          onClick={handlePrepare}
          type="button"
        >
          {isPreparing ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <FileCheck2 data-icon="inline-start" />
          )}
          Create fakeboot.img
        </Button>
      </div>

      {prepareResult ? (
        <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm">fakeboot.img is ready</p>
              <p className="mt-1 font-mono text-muted-foreground text-xs">
                {prepareResult.fakeBootRemotePath}
              </p>
            </div>
          </div>

          <ol className="grid gap-2 text-muted-foreground text-sm">
            {prepareResult.instructions.map((instruction) => (
              <li className="rounded-md border bg-background px-3 py-2" key={instruction}>
                {instruction}
              </li>
            ))}
          </ol>

          <DropZone
            acceptExtensions={['.img']}
            browseLabel="Select Patched Image"
            className="py-5"
            icon={FileCheck2}
            label={patchedImageName ?? 'Drop patched Magisk image here'}
            onBrowse={handleChoosePatchedImage}
            onFilesDropped={(paths) => {
              setPatchedImagePath(paths[0] ?? null);
              setFinalizeResult(null);
              setError(null);
            }}
            rejectMessage="Drop the Magisk patched .img file."
            sublabel={patchedImagePath ?? 'Optional: use this if ADB auto-detect cannot find it'}
          />

          <Button
            className="w-full gap-2"
            disabled={isFinalizing || !(serial || patchedImagePath)}
            id="root-manual-finalize"
            onClick={handleFinalize}
            type="button"
          >
            {isFinalizing ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <ShieldCheck data-icon="inline-start" />
            )}
            Finalize Root
          </Button>
        </div>
      ) : null}

      {finalizeResult ? (
        <Alert className="border-success/40 bg-success/10 text-success">
          <CheckCircle2 />
          <AlertTitle>Manual Patch Installed</AlertTitle>
          <AlertDescription>
            {finalizeResult.nextBootRecommendation} Restored {finalizeResult.restoredFiles.length}{' '}
            file
            {finalizeResult.restoredFiles.length === 1 ? '' : 's'}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="gap-2" onClick={onBack} type="button" variant="outline">
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
        <Button className="gap-2" onClick={onColdBoot} type="button" variant="outline">
          <RefreshCw data-icon="inline-start" />
          Cold Boot
        </Button>
      </div>
    </div>
  );
}
