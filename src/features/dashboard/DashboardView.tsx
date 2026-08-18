import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { type ReactNode, useCallback, useState } from 'react';
import { useDeviceTelemetry } from '@/features/dashboard/hooks/useDeviceTelemetry';
import { useRebootActions } from '@/features/dashboard/hooks/useRebootActions';
import { useWirelessAdb } from '@/features/dashboard/hooks/useWirelessAdb';
import {
  getDeviceMode,
  isWirelessSerial,
  supportsTelemetry,
  telemetryBlockedReason,
} from '@/features/dashboard/model/deviceMode';
import { useMemorySamples } from '@/features/dashboard/model/memoryHistoryStore';
import { BatteryPanel } from '@/features/dashboard/ui/BatteryPanel';
import { DeviceHeroBanner } from '@/features/dashboard/ui/DeviceHeroBanner';
import { MemoryPanel } from '@/features/dashboard/ui/MemoryPanel';
import { NoDeviceOnboarding } from '@/features/dashboard/ui/NoDeviceOnboarding';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { QuickActionsPanel } from '@/features/dashboard/ui/QuickActionsPanel';
import { RebootConfirmDialog } from '@/features/dashboard/ui/RebootConfirmDialog';
import { SecurityPanel } from '@/features/dashboard/ui/SecurityPanel';
import { StoragePanel } from '@/features/dashboard/ui/StoragePanel';
import { WirelessAdbPanel } from '@/features/dashboard/ui/WirelessAdbPanel';
import { EditNicknameDialog } from '@/shared/components/EditNicknameDialog';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { Button } from '@/shared/ui/button';
import { invalidateDevices, queryKeys } from '@/shared/utils/queries';

/**
 * Shared shape for the two "row of three" groups below (vitals; security +
 * actions) — same-weight panels, grouped by meaning rather than forced into a
 * fixed 2/1 split.
 *
 * Container queries, not viewport ones: the window is never below 1024px
 * (`minWidth` in `tauri.conf.json`), so `sm:`/`md:` could never evaluate false,
 * and what actually varies is this column's width as the sidebar collapses
 * (16rem expanded ↔ 3rem icon-only).
 *
 * The steps are measured, not guessed. At the 1024px window minimum with the
 * sidebar expanded the container is 1024 − 256 − 40 (p-5) − 10 (scrollbar
 * gutter) ≈ 718px. Going straight to three columns there gives ~228px per
 * panel, which truncates real values on a large device ("109.9 GB of 512.0 GB"
 * beside "402.1 GB free"). So there is a two-column step first:
 *   < 32rem  → 1 column
 *   ≥ 32rem  → 2 columns (~351px each at the 718px minimum)
 *   ≥ 56rem  → 3 columns (~314px each at a 1280px window, sidebar expanded)
 *
 * `items-start` stops a shorter card stretching to match a taller neighbour —
 * same-kind panels can still differ in natural height (Storage lists a variable
 * number of volumes), and that is an honest content difference, not the old
 * rigid pairing.
 *
 * In the two-column step a third panel would otherwise sit alone beside a gap.
 * `:nth-child(odd):last-child` matches an item that is both last and in an odd
 * slot — i.e. exactly the one that would be stranded — so it spans the full
 * row. It deliberately does not fire when only two panels render (telemetry
 * blocked hides Security), where the row is already balanced.
 */
const TRIO_GRID_CLASS = [
  'grid grid-cols-1 items-stretch gap-4',
  '@lg:grid-cols-2 @4xl:grid-cols-3',
  '@lg:[&>*:nth-child(odd):last-child]:col-span-2',
  '@4xl:[&>*:nth-child(odd):last-child]:col-span-1',
].join(' ');

function TelemetryNotice({
  action,
  message,
  title,
}: {
  action?: ReactNode | undefined;
  message: string;
  title: string;
}) {
  return (
    <PanelCard icon={CircleAlert} title={title}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-muted-foreground">{message}</p>
        {action}
      </div>
    </PanelCard>
  );
}

export function ViewDashboard({ activeView }: { activeView: string }) {
  const devices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const setActiveTab = useLogStore((state) => state.setActiveTab);
  const setPanelOpen = useLogStore((state) => state.setPanelOpen);
  const queryClient = useQueryClient();
  const [showWirelessPairing, setShowWirelessPairing] = useState(false);
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);

  const selectedDevice = devices.find((device) => device.serial === selectedSerial) ?? null;
  const mode = getDeviceMode(selectedDevice);
  const canReadTelemetry = supportsTelemetry(selectedDevice);

  const { telemetry, isLoading, isFetching, error, updatedAt, refresh } = useDeviceTelemetry(
    selectedSerial,
    activeView === 'dashboard' && canReadTelemetry,
  );
  const samples = useMemorySamples(selectedSerial);
  const wireless = useWirelessAdb(selectedSerial, telemetry?.network.ipAddress ?? null);
  const reboot = useRebootActions(selectedSerial);

  const isScanningDevices = useIsFetching({ queryKey: queryKeys.allDevices() }) > 0;

  const scanAgain = useCallback(() => {
    invalidateDevices(queryClient);
  }, [queryClient]);

  const openShell = useCallback(() => {
    setActiveTab('shell');
    setPanelOpen(true);
  }, [setActiveTab, setPanelOpen]);

  const toggleWirelessPairing = useCallback(() => {
    setShowWirelessPairing((open) => !open);
  }, []);

  if (!selectedDevice) {
    return (
      <>
        <h1 className="sr-only">Dashboard</h1>
        <NoDeviceOnboarding
          isScanning={isScanningDevices}
          onScanAgain={scanAgain}
          onToggleWireless={toggleWirelessPairing}
          showWireless={showWirelessPairing}
          wireless={wireless}
        />
      </>
    );
  }

  const deviceLabel = `${selectedDevice.serial} · ${selectedDevice.status}`;
  const quickActions = (
    <QuickActionsPanel
      isDisabled={mode === 'unavailable'}
      mode={mode}
      onOpenShell={openShell}
      onReboot={reboot.request}
      runningTarget={reboot.runningTarget}
      serial={selectedDevice.serial}
    />
  );
  const wirelessPanel = (
    <WirelessAdbPanel
      isConnected={isWirelessSerial(selectedDevice.serial)}
      showEnableStep={mode === 'adb' && !isWirelessSerial(selectedDevice.serial)}
      wireless={wireless}
    />
  );

  return (
    <div className="@container flex w-full max-w-[90rem] flex-col gap-4">
      <h1 className="sr-only">Dashboard</h1>
      {/* Hero Banner: Identity, status pulses, specs, serial, uptime, and consolidated sync */}
      <DeviceHeroBanner
        device={selectedDevice}
        isLoading={isLoading}
        isRefreshing={isFetching || isScanningDevices}
        onEditNickname={() => setShowNicknameDialog(true)}
        onRefresh={() => {
          scanAgain();
          if (canReadTelemetry) {
            refresh();
          }
        }}
        telemetry={telemetry}
        updatedAt={updatedAt}
      />
      {/* Vitals: battery / memory / storage are the same kind of thing —
          "resource X of Y with a percentage" — so sharing a row is honest. */}
      {canReadTelemetry ? (
        <div className={TRIO_GRID_CLASS}>
          <BatteryPanel battery={telemetry?.battery ?? null} isLoading={isLoading} />
          <MemoryPanel isLoading={isLoading} memory={telemetry?.memory ?? null} samples={samples} />
          {error && !telemetry ? (
            <TelemetryNotice
              action={
                <Button onClick={refresh} size="sm" type="button" variant="outline">
                  Try again
                </Button>
              }
              message={error.message}
              title="Telemetry failed"
            />
          ) : (
            <StoragePanel isLoading={isLoading} volumes={telemetry?.storage ?? []} />
          )}
        </div>
      ) : (
        <TelemetryNotice
          message={telemetryBlockedReason(selectedDevice)}
          title="Telemetry unavailable"
        />
      )}

      {/* Security posture and the things you can do about it. */}
      <div className={TRIO_GRID_CLASS}>
        {canReadTelemetry ? (
          <SecurityPanel isLoading={isLoading} security={telemetry?.security ?? null} />
        ) : null}
        {quickActions}
        {wirelessPanel}
      </div>
      <RebootConfirmDialog
        deviceLabel={deviceLabel}
        onCancel={reboot.dismiss}
        onConfirm={reboot.confirm}
        target={reboot.pendingConfirmation}
      />

      <EditNicknameDialog
        isOpen={showNicknameDialog}
        onOpenChange={setShowNicknameDialog}
        onSaved={() => setShowNicknameDialog(false)}
        serial={selectedDevice.serial}
      />
    </div>
  );
}
