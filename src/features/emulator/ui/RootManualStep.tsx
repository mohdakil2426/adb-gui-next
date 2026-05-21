import { CheckCircle2, FileCheck2, FolderOpen, Loader2, ShieldCheck } from 'lucide-react';
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

export function RootManualStep({ avdName, serial }: RootManualStepProps) {
  const { rootWizard, setRootWizardResult, updateManualState } = useEmulatorManagerStore();
  const state = rootWizard.manualState;

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

  const packageName = state.packagePath?.split(/[/\\]/).pop() ?? null;
  const patchedImageName = state.patchedImagePath?.split(/[/\\]/).pop() ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base text-foreground">Manual FAKEBOOTIMG Mode</h3>
          <p className="mt-1 font-semibold text-success text-xs">
            ★ Recommended Primary Method for Modern Magisk (v26.0 - v30.0+)
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            Create a custom temporary fake boot image, patch it inside the modern Magisk app in your
            emulator, then install the patched output back into the AVD ramdisk.
          </p>
        </div>
        <Badge variant="success">Modern Magisk</Badge>
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

      {state.error ? (
        <Alert variant="destructive">
          <ShieldCheck />
          <AlertTitle>Manual root failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button
          className="h-auto w-full justify-start gap-3 border-dashed px-4 py-5 text-left"
          id="root-manual-pick-package"
          onClick={handleChoosePackage}
          type="button"
          variant="outline"
        >
          <FolderOpen className="size-5 shrink-0 text-muted-foreground" data-icon="inline-start" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-sm">
              {packageName ?? 'Choose Magisk Package'}
            </span>
            <span className="block truncate text-muted-foreground text-xs">
              {state.packagePath ?? 'Supports .apk and .zip packages'}
            </span>
          </span>
        </Button>

        <Button
          className="w-full gap-2"
          disabled={!(serial && state.packagePath) || state.isPreparing}
          id="root-manual-create-fakeboot"
          onClick={handlePrepare}
          type="button"
        >
          {state.isPreparing ? (
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
          ) : (
            <FileCheck2 className="size-4" data-icon="inline-start" />
          )}
          Create fakeboot.img
        </Button>
      </div>

      {state.prepareResult ? (
        <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm">fakeboot.img is ready</p>
              <p className="mt-1 font-mono text-muted-foreground text-xs">
                {state.prepareResult.fakeBootRemotePath}
              </p>
            </div>
          </div>

          <ol className="grid gap-2 text-muted-foreground text-sm">
            {state.prepareResult.instructions.map((instruction) => (
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
              updateManualState({
                patchedImagePath: paths[0] ?? '',
                finalizeResult: null,
                error: null,
              });
            }}
            rejectMessage="Drop the Magisk patched .img file."
            sublabel={
              state.patchedImagePath ?? 'Optional: use this if ADB auto-detect cannot find it'
            }
          />

          <Button
            className="w-full gap-2"
            disabled={state.isFinalizing || !(serial || state.patchedImagePath)}
            id="root-manual-finalize"
            onClick={handleFinalize}
            type="button"
          >
            {state.isFinalizing ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <ShieldCheck data-icon="inline-start" />
            )}
            Finalize Root
          </Button>
        </div>
      ) : null}

      {state.finalizeResult ? (
        <Alert className="border-success/40 bg-success/10 text-success">
          <CheckCircle2 />
          <AlertTitle>Manual Patch Installed</AlertTitle>
          <AlertDescription>
            {state.finalizeResult.nextBootRecommendation} Restored{' '}
            {state.finalizeResult.restoredFiles.length} file
            {state.finalizeResult.restoredFiles.length === 1 ? '' : 's'}.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
