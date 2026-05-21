import { useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { ShieldCheck, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  LaunchAvd,
  RootAvd,
  ScanAvdRootReadiness,
  StopAvd,
  VerifyAvdRoot,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import {
  type RootWizardSource,
  useEmulatorManagerStore,
} from '@/features/emulator/model/emulatorManagerStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { invalidateAvds } from '@/shared/utils/queries';
import { RootManualStep } from './RootManualStep';
import { RootPreflightStep } from './RootPreflightStep';
import { RootProgressStep } from './RootProgressStep';
import { RootResultStep } from './RootResultStep';
import { RootSourceStep } from './RootSourceStep';
import { RootStepIndicator } from './RootStepIndicator';

interface RootWizardProps {
  avd: backend.AvdSummary;
}
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
  const [setupTab, setSetupTab] = useState<'autopilot' | 'manual'>('autopilot');
  const scanKey = `${avd.name}:${avd.serial ?? 'stopped'}`;

  // Map wizard step to STEPS index: Preflight (0), Setup (1), Patching (2), Verify (3)
  const stepIndex =
    rootWizard.step === 'preflight'
      ? 0
      : rootWizard.step === 'setup'
        ? 1
        : rootWizard.step === 'progress'
          ? 2
          : 3;
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
      // Auto-proceed to Setup if everything is green.
      if (scan.canProceed && !scan.hasWarnings) {
        setRootWizardStep('setup');
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
    setRootWizardStep('setup');
    setSetupTab('manual');
  }, [resetRootWizard, setRootWizardStep]);
  return (
    <div className="flex flex-col gap-6">
      <RootStepIndicator stepIndex={stepIndex} />
      {/* Step content */}
      {rootWizard.step === 'preflight' && (
        <RootPreflightStep
          avdName={avd.name}
          isScanning={isScanning}
          onColdBoot={handleColdBoot}
          onContinue={() => {
            setRootWizardStep('setup');
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
      {rootWizard.step === 'setup' && (
        <div className="flex flex-col gap-6">
          <Tabs
            className="w-full"
            onValueChange={(v) => setSetupTab(v as 'autopilot' | 'manual')}
            value={setupTab}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger className="gap-2" value="autopilot">
                <Zap className="size-4 text-primary" />
                Autopilot (Automated Magisk Patch)
              </TabsTrigger>
              <TabsTrigger className="gap-2" value="manual">
                <ShieldCheck className="size-4 text-warning" />
                Manual Fallback (FAKEBOOTIMG)
              </TabsTrigger>
            </TabsList>
            <div className="mt-4 rounded-lg border border-border bg-card p-6 shadow-sm">
              <TabsContent value="autopilot">
                <RootSourceStep
                  onContinue={handleContinue}
                  onSourceChange={handleSourceChange}
                  source={rootWizard.source}
                />
              </TabsContent>
              <TabsContent value="manual">
                <RootManualStep avdName={avd.name} serial={avd.serial ?? null} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
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
