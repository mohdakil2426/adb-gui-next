import { useQueryClient } from '@tanstack/react-query';
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
import { EventsOn } from '@/desktop/runtime';
import { useEmulatorManagerStore } from '@/features/emulator/model/emulatorManagerStore';
import {
  COLD_BOOT_LAUNCH_OPTIONS,
  DEFAULT_LAUNCH_OPTIONS,
} from '@/features/emulator/model/launchOptions';
import { useLogStore } from '@/shared/stores/logStore';
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
  // Atomic selectors. `root:progress` writes many times per second; subscribing
  // to the whole store re-rendered the wizard (and its children) on every tick
  // and on every unrelated emulator-store write.
  const step = useEmulatorManagerStore((s) => s.rootWizard.step);
  const setupTab = useEmulatorManagerStore((s) => s.rootWizard.setupTab);
  const source = useEmulatorManagerStore((s) => s.rootWizard.source);
  const progress = useEmulatorManagerStore((s) => s.rootWizard.progress);
  const result = useEmulatorManagerStore((s) => s.rootWizard.result);
  const verification = useEmulatorManagerStore((s) => s.rootWizard.verification);
  const isVerifying = useEmulatorManagerStore((s) => s.rootWizard.isVerifying);
  const error = useEmulatorManagerStore((s) => s.rootWizard.error);
  const preflightScan = useEmulatorManagerStore((s) => s.rootWizard.preflightScan);
  const setRootWizardStep = useEmulatorManagerStore((s) => s.setRootWizardStep);
  const setRootWizardSource = useEmulatorManagerStore((s) => s.setRootWizardSource);
  const setRootWizardProgress = useEmulatorManagerStore((s) => s.setRootWizardProgress);
  const setRootWizardResult = useEmulatorManagerStore((s) => s.setRootWizardResult);
  const setRootVerification = useEmulatorManagerStore((s) => s.setRootVerification);
  const setRootVerifying = useEmulatorManagerStore((s) => s.setRootVerifying);
  const setPreflightScan = useEmulatorManagerStore((s) => s.setPreflightScan);
  const resetRootWizard = useEmulatorManagerStore((s) => s.resetRootWizard);
  const setActiveTab = useEmulatorManagerStore((s) => s.setActiveTab);
  const setSetupTab = useEmulatorManagerStore((s) => s.setSetupTab);
  const applyLaunchPreset = useEmulatorManagerStore((s) => s.applyLaunchPreset);
  const queryClient = useQueryClient();
  const cancelledRef = useRef(false);
  const [isScanning, setIsScanning] = useState(false);

  // Map wizard step to STEPS index: Preflight (0), Setup (1), Patching (2), Verify (3)
  const stepIndex = step === 'preflight' ? 0 : step === 'setup' ? 1 : step === 'progress' ? 2 : 3;
  // Listen for root:progress events from Tauri backend via desktop runtime.
  useEffect(
    () =>
      EventsOn<backend.RootProgress>('root:progress', (payload) => {
        if (!cancelledRef.current) {
          setRootWizardProgress(payload);
        }
      }),
    [setRootWizardProgress],
  );
  // Run the preflight scan.
  const runScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const scan = await ScanAvdRootReadiness(avd.name, avd.serial);
      setPreflightScan(scan);
    } catch (err) {
      toast.error(`Preflight scan failed: ${String(err)}`);
    } finally {
      setIsScanning(false);
    }
  }, [avd.name, avd.serial, setPreflightScan]);
  function handleContinue() {
    if (!source) {
      return;
    }
    setRootWizardStep('progress');
    cancelledRef.current = false;
    void startRoot();
  }
  async function startRoot() {
    const src = source;
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
  // Both remedies write the preset they use into the shared launch options, so
  // the Launch tab always shows the configuration the emulator actually got.
  function handleLaunch() {
    applyLaunchPreset(DEFAULT_LAUNCH_OPTIONS);
    LaunchAvd(avd.name, DEFAULT_LAUNCH_OPTIONS)
      .then(() => toast.success(`Launching ${avd.name}…`))
      .catch((err: unknown) => toast.error(String(err)));
  }
  function handleColdBoot() {
    // The emulator may already be stopped (auto-shutdown after patching).
    // Attempt to stop gracefully, then cold boot with no-snapshot flags.
    applyLaunchPreset(COLD_BOOT_LAUNCH_OPTIONS);
    const stopPromise = avd.serial
      ? StopAvd(avd.serial).catch(() => {
          // ignore stop failures — device may already be offline
        })
      : Promise.resolve();
    void stopPromise
      .then(() => LaunchAvd(avd.name, COLD_BOOT_LAUNCH_OPTIONS))
      .then(() => {
        toast.success(`Cold booting ${avd.name}…`);
        useLogStore.getState().addLog(`Cold boot launched for ${avd.name}`, 'info');
      })
      .catch((err: unknown) => {
        toast.error(`Cold boot failed: ${String(err)}`);
        useLogStore.getState().addLog(`Cold boot failed for ${avd.name}: ${String(err)}`, 'error');
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
  }, [resetRootWizard, setRootWizardStep, setSetupTab]);
  return (
    <div className="flex flex-col gap-4">
      <RootStepIndicator stepIndex={stepIndex} />
      {/* Step content */}
      {step === 'preflight' && (
        <RootPreflightStep
          avdName={avd.name}
          isScanning={isScanning}
          onColdBoot={handleColdBoot}
          onContinue={() => {
            setRootWizardStep('setup');
          }}
          onLaunch={handleLaunch}
          onRescan={() => {
            setPreflightScan(null);
            void runScan();
          }}
          onRestoreStock={handleRestoreStock}
          scan={preflightScan}
        />
      )}
      {step === 'setup' && (
        <Tabs
          className="w-full"
          onValueChange={(v) => setSetupTab(v as 'autopilot' | 'manual')}
          value={setupTab}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger className="gap-2" value="autopilot">
              <Zap aria-hidden="true" className="size-4" />
              Autopilot (Magisk v25.2 and older)
            </TabsTrigger>
            <TabsTrigger className="gap-2" value="manual">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Manual FAKEBOOTIMG (Magisk v26+)
            </TabsTrigger>
          </TabsList>
          <div className="mt-3 rounded-md border border-border bg-surface-raised p-4">
            <TabsContent value="autopilot">
              <RootSourceStep
                onContinue={handleContinue}
                onSourceChange={setRootWizardSource}
                source={source}
              />
            </TabsContent>
            <TabsContent value="manual">
              <RootManualStep avdName={avd.name} serial={avd.serial ?? null} />
            </TabsContent>
          </div>
        </Tabs>
      )}
      {step === 'progress' && (
        <RootProgressStep
          avdName={avd.name}
          error={error}
          onCancel={handleCancel}
          progress={progress}
        />
      )}
      {step === 'result' && (
        <RootResultStep
          avdName={avd.name}
          error={error}
          isVerifying={isVerifying}
          onColdBoot={handleColdBoot}
          onReset={resetRootWizard}
          onRestoreStock={handleRestoreStock}
          onTryManual={handleTryManual}
          onVerifyRoot={handleVerifyRoot}
          result={result}
          serial={avd.serial ?? ''}
          verification={verification}
        />
      )}
    </div>
  );
}
