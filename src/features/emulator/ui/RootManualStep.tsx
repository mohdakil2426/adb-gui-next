import { CircleCheck, FileCheck2, FolderOpen, Loader2, ShieldCheck, Star } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  FinalizeAvdRoot,
  PrepareAvdRoot,
  SelectPatchedRootImageFile,
  SelectRootPackageFile,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useEmulatorManagerStore } from '@/features/emulator/model/emulatorManagerStore';
import { DropZone } from '@/shared/components/DropZone';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

interface RootManualStepProps {
  avdName: string;
  serial: string | null;
}

/** Module constant: a fresh array literal re-registers the window drag-drop handler. */
const PATCHED_IMAGE_EXTENSIONS = ['.img'];

export function RootManualStep({ avdName, serial }: RootManualStepProps) {
  // Atomic selectors: subscribing to the whole store re-rendered this step on
  // every root:progress tick, which fires many times per second while patching.
  const state = useEmulatorManagerStore((s) => s.rootWizard.manualState);
  const setRootWizardResult = useEmulatorManagerStore((s) => s.setRootWizardResult);
  const updateManualState = useEmulatorManagerStore((s) => s.updateManualState);

  async function handleChoosePackage() {
    const path = await SelectRootPackageFile();
    if (!path) {
      return;
    }
    updateManualState({
      packagePath: path,
      patchedImagePath: null,
      prepareResult: null,
      finalizeResult: null,
      error: null,
    });
  }

  async function handleChoosePatchedImage() {
    const path = await SelectPatchedRootImageFile();
    if (!path) {
      return;
    }
    updateManualState({
      patchedImagePath: path,
      finalizeResult: null,
      error: null,
    });
  }

  async function handlePrepare() {
    if (!(serial && state.packagePath)) {
      return;
    }
    updateManualState({ isPreparing: true, error: null });
    try {
      const result = await PrepareAvdRoot({
        avdName,
        serial,
        rootPackagePath: state.packagePath,
      });
      updateManualState({
        prepareResult: result,
        patchedImagePath: null,
        finalizeResult: null,
      });
      toast.success('fakeboot.img created and Magisk launched');
    } catch (err) {
      const message = String(err);
      updateManualState({ error: message });
      toast.error(message);
    } finally {
      updateManualState({ isPreparing: false });
    }
  }

  async function handleFinalize() {
    if (!(serial || state.patchedImagePath)) {
      return;
    }
    updateManualState({ isFinalizing: true, error: null });
    try {
      const result = await FinalizeAvdRoot({
        avdName,
        serial,
        ...(state.patchedImagePath && { patchedImagePath: state.patchedImagePath }),
      });
      updateManualState({ finalizeResult: result });
      toast.success('Manual patch installed');

      // Map FinalizeResult to RootAvdResult for unified Result Screen
      const avdResult: backend.RootAvdResult = {
        activationStatus: 'patchInstalled',
        magiskVersion: 'Manual',
        managerInstalled: true,
        message: result.nextBootRecommendation || 'Manual patch installed successfully.',
        patchedRamdiskPath: '',
      };
      setRootWizardResult(avdResult);
    } catch (err) {
      const message = String(err);
      updateManualState({ error: message });
      toast.error(message);
    } finally {
      updateManualState({ isFinalizing: false });
    }
  }

  const handlePatchedImageDropped = useCallback(
    (paths: string[]) => {
      updateManualState({
        patchedImagePath: paths[0] ?? '',
        finalizeResult: null,
        error: null,
      });
    },
    [updateManualState],
  );

  const packageName = state.packagePath?.split(/[/\\]/).pop() ?? null;
  const patchedImageName = state.patchedImagePath?.split(/[/\\]/).pop() ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-title">Manual FAKEBOOTIMG Mode</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-caption text-success">
            <Star aria-hidden="true" className="size-3.5" />
            Recommended for modern Magisk (v26 and above)
          </p>
          <p className="mt-1 text-body text-muted-foreground">
            Create a temporary fake boot image, patch it inside the Magisk app on the emulator, then
            install the patched output back into the AVD ramdisk.
          </p>
        </div>
        <Badge variant="success">Modern Magisk</Badge>
      </div>

      {!serial && (
        <Alert variant="destructive">
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Emulator is not online</AlertTitle>
          <AlertDescription>
            Launch the AVD and wait until it appears as online in ADB, then create fakeboot.img.
          </AlertDescription>
        </Alert>
      )}

      {state.error ? (
        <Alert variant="destructive">
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Manual root failed</AlertTitle>
          <AlertDescription>
            {state.error}. Confirm the emulator is online and the package is a Magisk .apk or .zip,
            then try again.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          className="h-auto w-full justify-start gap-3 border-dashed px-3 py-4 text-left"
          id="root-manual-pick-package"
          onClick={() => {
            void handleChoosePackage();
          }}
          type="button"
          variant="outline"
        >
          <FolderOpen
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
            data-icon="inline-start"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-body">
              {packageName ?? 'Choose Magisk Package'}
            </span>
            <span className="block truncate font-mono text-mono-sm text-muted-foreground">
              {state.packagePath ?? 'Supports .apk and .zip packages'}
            </span>
          </span>
        </Button>

        <Button
          className="w-full"
          disabled={!(serial && state.packagePath) || state.isPreparing}
          id="root-manual-create-fakeboot"
          onClick={() => {
            void handlePrepare();
          }}
          size="sm"
          type="button"
        >
          {state.isPreparing ? (
            <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
          ) : (
            <FileCheck2 aria-hidden="true" />
          )}
          Create fakeboot.img
        </Button>
      </div>

      {state.prepareResult ? (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-3">
          <div className="flex items-start gap-3">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-body text-foreground">fakeboot.img is ready</p>
              <p className="mt-0.5 break-all font-mono text-mono text-muted-foreground">
                {state.prepareResult.fakeBootRemotePath}
              </p>
            </div>
          </div>

          <ol className="grid gap-1.5 text-body text-muted-foreground">
            {state.prepareResult.instructions.map((instruction) => (
              <li
                className="rounded-md border border-border bg-surface px-3 py-2"
                key={instruction}
              >
                {instruction}
              </li>
            ))}
          </ol>

          <DropZone
            acceptExtensions={PATCHED_IMAGE_EXTENSIONS}
            browseLabel="Select Patched Image"
            className="py-4"
            icon={FileCheck2}
            label={patchedImageName ?? 'Drop patched Magisk image here'}
            onBrowse={() => {
              void handleChoosePatchedImage();
            }}
            onFilesDropped={handlePatchedImageDropped}
            rejectMessage="Drop the Magisk patched .img file."
            sublabel={
              state.patchedImagePath ?? 'Optional: use this if ADB auto-detect cannot find it'
            }
          />

          <Button
            className="w-full"
            disabled={state.isFinalizing || !(serial || state.patchedImagePath)}
            id="root-manual-finalize"
            onClick={() => {
              void handleFinalize();
            }}
            size="sm"
            type="button"
          >
            {state.isFinalizing ? (
              <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
            ) : (
              <ShieldCheck aria-hidden="true" data-icon="inline-start" />
            )}
            Finalize Root
          </Button>
        </div>
      ) : null}

      {state.finalizeResult ? (
        <Alert className="border-success/30 bg-success-muted">
          <CircleCheck aria-hidden="true" className="text-success" />
          <AlertTitle>Manual patch installed</AlertTitle>
          <AlertDescription className="numeric">
            {state.finalizeResult.nextBootRecommendation} Restored{' '}
            {state.finalizeResult.restoredFiles.length} file
            {state.finalizeResult.restoredFiles.length === 1 ? '' : 's'}.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
