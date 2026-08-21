import { HardDrive, LayoutDashboard, Package, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useFlashBatchQueue } from '@/features/flasher/hooks/useFlashBatchQueue';
import { useFlasherActions } from '@/features/flasher/hooks/useFlasherActions';
import { useFlasherDropTargets } from '@/features/flasher/hooks/useFlasherDropTargets';
import { useFlasherTelemetry } from '@/features/flasher/hooks/useFlasherTelemetry';
import type { FlasherTab } from '@/features/flasher/model/flasherTypes';
import { FlasherOverviewTab } from '@/features/flasher/overview/FlasherOverviewTab';
import { FlasherPartitionTab } from '@/features/flasher/partition/FlasherPartitionTab';
import { FlasherSideloadTab } from '@/features/flasher/sideload/FlasherSideloadTab';
import { FlasherCockpitHero } from '@/features/flasher/ui/FlasherCockpitHero';
import { FlasherConfirmations } from '@/features/flasher/ui/FlasherConfirmations';
import { FlasherWipeTab } from '@/features/flasher/wipe/FlasherWipeTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export function ViewFlasher({ initialTab = 'overview' }: { initialTab?: FlasherTab } = {}) {
  const [activeTab, setActiveTab] = useState<FlasherTab>(initialTab);
  const {
    confirmFlash,
    confirmSideload,
    filePath,
    handleConfirmOpenChange,
    handleSelectImageFile,
    handleSelectSideloadFile,
    handleWipe,
    isGlobalLoading,
    loadingAction,
    partition,
    pendingConfirm,
    requestFlash,
    requestSideload,
    selectedFastbootSerial,
    selectedSideloadSerial,
    setFilePath,
    setPartition,
    setSideloadFilePath,
    sideloadFilePath,
  } = useFlasherActions();

  const {
    diagnostics,
    vitals,
    isProbing,
    lastUpdated,
    refresh,
    switchSlot,
    rebootDevice,
    isFastbootMode,
    selectedDevice,
  } = useFlasherTelemetry();
  const {
    queue,
    isBatchFlashing,
    currentIndex,
    addToQueue,
    removeFromQueue,
    clearQueue,
    executeBatch,
  } = useFlashBatchQueue();

  // Refs for position-based hit-testing during Tauri file drag & drop
  const flashSectionRef = useRef<HTMLDivElement>(null);
  const sideloadSectionRef = useRef<HTMLDivElement>(null);

  const { dragTarget } = useFlasherDropTargets({
    flashSectionRef,
    setFilePath,
    setSideloadFilePath,
    sideloadSectionRef,
  });

  const handleRebootBootloader = useCallback(() => {
    void rebootDevice('bootloader');
  }, [rebootDevice]);

  const handleRebootFastboot = useCallback(() => {
    void rebootDevice('fastboot');
  }, [rebootDevice]);

  const handleRebootRecovery = useCallback(() => {
    void rebootDevice('recovery');
  }, [rebootDevice]);

  const handleRebootSystem = useCallback(() => {
    void rebootDevice('system');
  }, [rebootDevice]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Flasher</h1>

      {/* ── Precision Hardware Cockpit Hero Banner ───────────────────── */}
      <FlasherCockpitHero
        isFastbootMode={isFastbootMode}
        isProbing={isProbing}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        onSwitchSlot={switchSlot}
        vitals={vitals}
      />

      {/* ── 4-Tab Hardware Navigation ────────────────────────────────── */}
      <Tabs
        className="flex flex-col gap-4"
        onValueChange={(v) => setActiveTab(v as FlasherTab)}
        value={activeTab}
      >
        <TabsList className="w-full bg-surface-raised p-1">
          <TabsTrigger className="flex-1 gap-2 font-medium text-caption" value="overview">
            <LayoutDashboard className="size-4" />
            <span>Overview & Diagnostics</span>
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-2 font-medium text-caption" value="partition">
            <HardDrive className="size-4" />
            <span>Partition Flasher</span>
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-2 font-medium text-caption" value="sideload">
            <Package className="size-4" />
            <span>Recovery Sideload</span>
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-2 font-medium text-caption" value="wipe">
            <Trash2 className="size-4" />
            <span>Partitions & Wipe</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview & Diagnostics */}
        <TabsContent className="m-0 focus-visible:outline-none" value="overview">
          <FlasherOverviewTab
            diagnostics={diagnostics}
            isFastbootMode={isFastbootMode}
            isProbing={isProbing}
            onRebootBootloader={handleRebootBootloader}
            onRefresh={refresh}
            vitals={vitals}
          />
        </TabsContent>

        {/* Tab 2: Partition Flasher Studio */}
        <TabsContent className="m-0 focus-visible:outline-none" value="partition">
          <FlasherPartitionTab
            currentIndex={currentIndex}
            dragTarget={dragTarget}
            filePath={filePath}
            flashSectionRef={flashSectionRef}
            isBatchFlashing={isBatchFlashing}
            isFastbootMode={isFastbootMode}
            isGlobalLoading={isGlobalLoading}
            loadingAction={loadingAction}
            onAddToQueue={addToQueue}
            onClearQueue={clearQueue}
            onExecuteBatch={() => void executeBatch(selectedFastbootSerial)}
            onRebootFastboot={handleRebootFastboot}
            onRemoveQueueItem={removeFromQueue}
            onSelectImageFile={handleSelectImageFile}
            onSwitchSlot={switchSlot}
            partition={partition}
            queue={queue}
            requestFlash={requestFlash}
            selectedFastbootSerial={selectedFastbootSerial}
            setFilePath={setFilePath}
            setPartition={setPartition}
            vitals={vitals}
          />
        </TabsContent>

        {/* Tab 3: Recovery Sideload Studio */}
        <TabsContent className="m-0 focus-visible:outline-none" value="sideload">
          <FlasherSideloadTab
            dragTarget={dragTarget}
            isGlobalLoading={isGlobalLoading}
            loadingAction={loadingAction}
            onCheckSideloadState={refresh}
            onRebootRecovery={handleRebootRecovery}
            onRebootSystem={handleRebootSystem}
            onSelectSideloadFile={handleSelectSideloadFile}
            requestSideload={requestSideload}
            selectedDeviceSerial={selectedDevice?.serial ?? null}
            selectedSideloadSerial={selectedSideloadSerial}
            setSideloadFilePath={setSideloadFilePath}
            sideloadFilePath={sideloadFilePath}
            sideloadSectionRef={sideloadSectionRef}
          />
        </TabsContent>

        {/* Tab 4: Partitions & Wipe Utility */}
        <TabsContent className="m-0 focus-visible:outline-none" value="wipe">
          <FlasherWipeTab
            disabled={isGlobalLoading}
            isLoading={loadingAction === 'wipe'}
            onWipeData={() => void handleWipe()}
            serial={selectedFastbootSerial}
          />
        </TabsContent>
      </Tabs>

      {/* ── Flasher Confirmation Dialogs ─────────────────────────────── */}
      <FlasherConfirmations
        fastbootSerial={selectedFastbootSerial}
        imagePath={filePath}
        onConfirmFlash={confirmFlash}
        onConfirmSideload={confirmSideload}
        onOpenChange={handleConfirmOpenChange}
        packagePath={sideloadFilePath}
        partition={partition}
        pending={pendingConfirm}
        sideloadSerial={selectedSideloadSerial}
      />
    </div>
  );
}
