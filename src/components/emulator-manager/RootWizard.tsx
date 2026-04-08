import { useCallback, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { backend } from '@/lib/desktop/models';
import { RootAvd, LaunchAvd, StopAvd } from '@/lib/desktop/backend';
import { useEmulatorManagerStore, type RootWizardSource } from '@/lib/emulatorManagerStore';
import { RootSourceStep } from './RootSourceStep';
import { RootProgressStep } from './RootProgressStep';
import { RootResultStep } from './RootResultStep';

interface RootWizardProps {
  avd: backend.AvdSummary;
}

const STEPS = ['Source', 'Rooting', 'Done'];

export function RootWizard({ avd }: RootWizardProps) {
  const {
    rootWizard,
    setRootWizardStep,
    setRootWizardSource,
    setRootWizardProgress,
    setRootWizardResult,
    resetRootWizard,
    setActiveTab,
  } = useEmulatorManagerStore();

  const cancelledRef = useRef(false);

  // Listen for root:progress events from Tauri backend.
  useEffect(() => {
    const unlistenPromise = listen<backend.RootProgress>('root:progress', (event) => {
      if (!cancelledRef.current) {
        setRootWizardProgress(event.payload);
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [setRootWizardProgress]);

  const stepIndex = STEPS.indexOf(
    rootWizard.step === 'source' ? 'Source' : rootWizard.step === 'progress' ? 'Rooting' : 'Done',
  );

  function handleSourceChange(src: RootWizardSource) {
    setRootWizardSource(src);
  }

  function handleContinue() {
    if (!rootWizard.source) return;
    setRootWizardStep('progress');
    cancelledRef.current = false;
    startRoot();
  }

  async function startRoot() {
    const src = rootWizard.source;
    if (!src || !avd.serial) {
      setRootWizardResult(null, 'Emulator is not running. Launch it first.');
      return;
    }

    const request: backend.RootAvdRequest = {
      avdName: avd.name,
      serial: avd.serial,
      source:
        src.type === 'stable'
          ? { type: 'latestStable' as const }
          : { type: 'localFile' as const, value: src.path },
    };

    try {
      const result = await RootAvd(request);
      if (!cancelledRef.current) {
        setRootWizardResult(result);
        toast.success(`Rooted ${avd.name} with Magisk v${result.magiskVersion}`);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        const errMsg = String(err);
        setRootWizardResult(null, errMsg);
        toast.error('Root failed');
      }
    }
  }

  function handleCancel() {
    cancelledRef.current = true;
    resetRootWizard();
    toast.info('Rooting cancelled');
  }

  function handleColdBoot() {
    // The emulator may already be stopped (auto-shutdown after patching).
    // Attempt to stop gracefully, then cold boot with no-snapshot flags.
    const stopPromise = avd.serial ? StopAvd(avd.serial).catch(() => {}) : Promise.resolve();
    stopPromise
      .then(() =>
        LaunchAvd(avd.name, {
          wipeData: false,
          writableSystem: false,
          coldBoot: true,
          noSnapshotLoad: true,
          noSnapshotSave: true,
          noBootAnim: false,
        }),
      )
      .then(() => toast.success(`Cold booting ${avd.name}…`))
      .catch((err: unknown) => toast.error(String(err)));
    resetRootWizard();
  }

  function handleRestoreStock() {
    resetRootWizard();
    setActiveTab('restore');
  }

  const handleTryManual = useCallback(() => {
    resetRootWizard();
    // Signal to EmulatorRootTab to show the legacy flow
    setRootWizardStep('source');
  }, [resetRootWizard, setRootWizardStep]);

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, idx) => {
          const done = idx < stepIndex;
          const active = idx === stepIndex;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  done && 'border-emerald-500 bg-emerald-500 text-white',
                  active && 'border-primary bg-primary text-primary-foreground',
                  !done && !active && 'border-border bg-background text-muted-foreground',
                )}
              >
                {done ? <CheckCircle2 className="size-3.5" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-sm',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-px w-8 transition-colors',
                    done ? 'bg-emerald-500' : 'bg-border',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {rootWizard.step === 'source' && (
        <RootSourceStep
          source={rootWizard.source}
          onSourceChange={handleSourceChange}
          onContinue={handleContinue}
        />
      )}

      {rootWizard.step === 'progress' && (
        <RootProgressStep
          progress={rootWizard.progress}
          error={rootWizard.error}
          avdName={avd.name}
          onCancel={handleCancel}
        />
      )}

      {rootWizard.step === 'result' && (
        <RootResultStep
          result={rootWizard.result}
          error={rootWizard.error}
          avdName={avd.name}
          serial={avd.serial ?? ''}
          onColdBoot={handleColdBoot}
          onRestoreStock={handleRestoreStock}
          onTryManual={handleTryManual}
          onReset={resetRootWizard}
        />
      )}
    </div>
  );
}
