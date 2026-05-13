import { useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  LaunchAvd,
  RootAvd,
  ScanAvdRootReadiness,
  StopAvd,
  VerifyAvdRoot,
} from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import { type RootWizardSource, useEmulatorManagerStore } from '@/lib/emulatorManagerStore';
import { invalidateAvds } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { RootManualStep } from './RootManualStep';
import { RootPreflightStep } from './RootPreflightStep';
import { RootProgressStep } from './RootProgressStep';
import { RootResultStep } from './RootResultStep';
import { RootSourceStep } from './RootSourceStep';

interface RootWizardProps {
  avd: backend.AvdSummary;
}

const STEPS = ['Preflight', 'Source', 'Manual', 'Rooting', 'Done'];

export function RootWizard({ avd }: RootWizardProps) {
  const {
    rootWizard,
    setRootWizardStep,
    setRootWizardSource,
    setRootWizardProgress,
    setRootWizardResult,
    setRootVerification,
    setRootVerifying,
    setPreflightScan,
    resetRootWizard,
    setActiveTab,
  } = useEmulatorManagerStore();

  const queryClient = useQueryClient();

  const cancelledRef = useRef(false);
  const autoScanKeyRef = useRef<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanKey = `${avd.name}:${avd.serial ?? 'stopped'}`;

  // Map wizard step to STEPS index
  const stepIndex =
    rootWizard.step === 'preflight'
      ? 0
      : rootWizard.step === 'source'
        ? 1
        : rootWizard.step === 'manual'
          ? 2
          : rootWizard.step === 'progress'
            ? 3
            : 4;

  // Listen for root:progress events from Tauri backend.
  useEffect(() => {
    const unlistenPromise = listen<backend.RootProgress>('root:progress', (event) => {
      if (!cancelledRef.current) {
        setRootWizardProgress(event.payload);
      }
    });
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      unlistenPromise.then((fn) => {
        fn();
      });
    };
  }, [setRootWizardProgress]);

  // Run the preflight scan.
  const runScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const scan = await ScanAvdRootReadiness(avd.name, avd.serial);
      setPreflightScan(scan);
      // Auto-proceed to Source if everything is green.
      if (scan.canProceed && !scan.hasWarnings) {
        setRootWizardStep('source');
      }
    } catch (err) {
      toast.error(`Preflight scan failed: ${String(err)}`);
    } finally {
      setIsScanning(false);
    }
  }, [avd.name, avd.serial, setPreflightScan, setRootWizardStep]);

  // Trigger scan automatically when entering preflight step.
  useEffect(() => {
    if (rootWizard.step !== 'preflight') {
      autoScanKeyRef.current = null;
      return;
    }

    if (rootWizard.preflightScan === null && !isScanning && autoScanKeyRef.current !== scanKey) {
      autoScanKeyRef.current = scanKey;
      void runScan();
    }
  }, [rootWizard.step, rootWizard.preflightScan, isScanning, runScan, scanKey]);

  function handleSourceChange(src: RootWizardSource) {
    setRootWizardSource(src);
  }

  function handleContinue() {
    if (!rootWizard.source) {
      return;
    }
    setRootWizardStep('progress');
    cancelledRef.current = false;
    void startRoot();
  }

  async function startRoot() {
    const src = rootWizard.source;
    if (!(src && avd.serial)) {
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
        toast.success(`Patch installed for ${avd.name}. Cold boot to verify root.`);
        invalidateAvds(queryClient);
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

  function handleLaunch() {
    LaunchAvd(avd.name, {
      wipeData: false,
      writableSystem: false,
      coldBoot: false,
      noSnapshotLoad: false,
      noSnapshotSave: false,
      noBootAnim: false,
    })
      .then(() => toast.success(`Launching ${avd.name}…`))
      .catch((err: unknown) => toast.error(String(err)));
  }

  function handleColdBoot() {
    // The emulator may already be stopped (auto-shutdown after patching).
    // Attempt to stop gracefully, then cold boot with no-snapshot flags.
    const stopPromise = avd.serial
      ? StopAvd(avd.serial).catch(() => {
          // ignore
        })
      : Promise.resolve();
    void stopPromise
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
      .catch(() => {
        // ignore
      });
  }

  async function handleVerifyRoot() {
    if (!avd.serial) {
      toast.error(
        'Emulator is not online yet. Wait for the cold boot to finish, then verify again.',
      );
      return;
    }

    setRootVerifying(true);
    try {
      const verification = await VerifyAvdRoot(avd.name, avd.serial);
      setRootVerification(verification);
      if (verification.status === 'verified') {
        toast.success('Root verified: su returned uid 0');
      } else {
        toast.error('Root not verified yet');
      }
    } catch (error) {
      toast.error(String(error));
    } finally {
      setRootVerifying(false);
    }
  }

  function handleRestoreStock() {
    resetRootWizard();
    setActiveTab('restore');
  }

  const handleTryManual = useCallback(() => {
    resetRootWizard();
    setRootWizardStep('manual');
  }, [resetRootWizard, setRootWizardStep]);

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, idx) => {
          const done = idx < stepIndex;
          const active = idx === stepIndex;
          return (
            <div className="flex items-center gap-2" key={label}>
              <div
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border font-semibold text-xs transition-colors',
                  done && 'border-success bg-success text-success-foreground',
                  active && 'border-primary bg-primary text-primary-foreground',
                  !(done || active) && 'border-border bg-background text-muted-foreground',
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
                  className={cn('h-px w-8 transition-colors', done ? 'bg-success' : 'bg-border')}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {rootWizard.step === 'preflight' && (
        <RootPreflightStep
          avdName={avd.name}
          isScanning={isScanning}
          onColdBoot={handleColdBoot}
          onContinue={() => {
            setRootWizardStep('source');
          }}
          onLaunch={handleLaunch}
          onRescan={() => {
            autoScanKeyRef.current = scanKey;
            setPreflightScan(null);
            void runScan();
          }}
          onRestoreStock={handleRestoreStock}
          scan={rootWizard.preflightScan}
        />
      )}

      {rootWizard.step === 'source' && (
        <RootSourceStep
          onContinue={handleContinue}
          onManualMode={() => {
            setRootWizardStep('manual');
          }}
          onSourceChange={handleSourceChange}
          source={rootWizard.source}
        />
      )}

      {rootWizard.step === 'manual' && (
        <RootManualStep
          avdName={avd.name}
          onBack={() => {
            setRootWizardStep('source');
          }}
          onColdBoot={handleColdBoot}
          serial={avd.serial ?? null}
        />
      )}

      {rootWizard.step === 'progress' && (
        <RootProgressStep
          avdName={avd.name}
          error={rootWizard.error}
          onCancel={handleCancel}
          progress={rootWizard.progress}
        />
      )}

      {rootWizard.step === 'result' && (
        <RootResultStep
          avdName={avd.name}
          error={rootWizard.error}
          isVerifying={rootWizard.isVerifying}
          onColdBoot={handleColdBoot}
          onReset={resetRootWizard}
          onRestoreStock={handleRestoreStock}
          onTryManual={handleTryManual}
          onVerifyRoot={handleVerifyRoot}
          result={rootWizard.result}
          serial={avd.serial ?? ''}
          verification={rootWizard.verification}
        />
      )}
    </div>
  );
}
