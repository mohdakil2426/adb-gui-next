import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useReducer } from 'react';
import { toast } from 'sonner';
import {
  FinalizeAvdRoot,
  PrepareAvdRoot,
  SelectPatchedRootImageFile,
  SelectRootPackageFile,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { DropZone } from '@/shared/components/DropZone';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

type State = {
  packagePath: string | null;
  patchedImagePath: string | null;
  prepareResult: backend.RootPreparationResult | null;
  finalizeResult: backend.RootFinalizeResult | null;
  error: string | null;
  isPreparing: boolean;
  isFinalizing: boolean;
};

type Action =
  | { type: 'CHOOSE_PACKAGE'; payload: string }
  | { type: 'CHOOSE_PATCHED_IMAGE'; payload: string }
  | { type: 'SET_IS_PREPARING'; payload: boolean }
  | { type: 'SET_IS_FINALIZING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'PREPARE_SUCCESS'; payload: backend.RootPreparationResult }
  | { type: 'FINALIZE_SUCCESS'; payload: backend.RootFinalizeResult }
  | { type: 'CLEAR_FINALIZE_RESULT' };

const cleared = { patchedImagePath: null, prepareResult: null, finalizeResult: null, error: null };
const clearedFinalize = { finalizeResult: null, error: null };
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CHOOSE_PACKAGE':
      return { ...state, packagePath: action.payload, ...cleared };
    case 'CHOOSE_PATCHED_IMAGE':
      return { ...state, patchedImagePath: action.payload, ...clearedFinalize };
    case 'SET_IS_PREPARING':
      return { ...state, isPreparing: action.payload };
    case 'SET_IS_FINALIZING':
      return { ...state, isFinalizing: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'PREPARE_SUCCESS':
      return {
        ...state,
        prepareResult: action.payload,
        patchedImagePath: null,
        finalizeResult: null,
      };
    case 'FINALIZE_SUCCESS':
      return { ...state, finalizeResult: action.payload };
    case 'CLEAR_FINALIZE_RESULT':
      return { ...state, finalizeResult: null };
    default:
      return state;
  }
}

interface RootManualStepProps {
  avdName: string;
  onBack: () => void;
  onColdBoot: () => void;
  serial: string | null;
}

export function RootManualStep({ avdName, serial, onBack, onColdBoot }: RootManualStepProps) {
  const [state, dispatch] = useReducer(reducer, {
    packagePath: null,
    patchedImagePath: null,
    prepareResult: null,
    finalizeResult: null,
    error: null,
    isPreparing: false,
    isFinalizing: false,
  });

  async function handleChoosePackage() {
    const path = await SelectRootPackageFile();
    if (!path) {
      return;
    }
    dispatch({ type: 'CHOOSE_PACKAGE', payload: path });
  }

  async function handleChoosePatchedImage() {
    const path = await SelectPatchedRootImageFile();
    if (!path) {
      return;
    }
    dispatch({ type: 'CHOOSE_PATCHED_IMAGE', payload: path });
  }
  async function handlePrepare() {
    if (!(serial && state.packagePath)) {
      return;
    }
    dispatch({ type: 'SET_IS_PREPARING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const result = await PrepareAvdRoot({
        avdName,
        serial,
        rootPackagePath: state.packagePath,
      });
      dispatch({ type: 'PREPARE_SUCCESS', payload: result });
      toast.success('fakeboot.img created and Magisk launched');
    } catch (err) {
      const message = String(err);
      dispatch({ type: 'SET_ERROR', payload: message });
      toast.error(message);
    } finally {
      dispatch({ type: 'SET_IS_PREPARING', payload: false });
    }
  }

  async function handleFinalize() {
    if (!(serial || state.patchedImagePath)) {
      return;
    }
    dispatch({ type: 'SET_IS_FINALIZING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const result = await FinalizeAvdRoot({
        avdName,
        serial,
        ...(state.patchedImagePath && { patchedImagePath: state.patchedImagePath }),
      });
      dispatch({ type: 'FINALIZE_SUCCESS', payload: result });
      toast.success('Manual patch installed');
    } catch (err) {
      const message = String(err);
      dispatch({ type: 'SET_ERROR', payload: message });
      toast.error(message);
    } finally {
      dispatch({ type: 'SET_IS_FINALIZING', payload: false });
    }
  }

  const packageName = state.packagePath?.split(/[/\\]/).pop() ?? null;
  const patchedImageName = state.patchedImagePath?.split(/[/\\]/).pop() ?? null;

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

      {state.error ? (
        <Alert variant="destructive">
          <ShieldCheck />
          <AlertTitle>Manual root failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
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
              {state.packagePath ?? 'Supports .apk and .zip packages'}
            </span>
          </span>
        </Button>

        <Button
          className="gap-2"
          disabled={!(serial && state.packagePath) || state.isPreparing}
          id="root-manual-create-fakeboot"
          onClick={handlePrepare}
          type="button"
        >
          {state.isPreparing ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <FileCheck2 data-icon="inline-start" />
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
              dispatch({ type: 'CHOOSE_PATCHED_IMAGE', payload: paths[0] ?? '' });
              dispatch({ type: 'CLEAR_FINALIZE_RESULT' });
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
