import { HardDrive, Package, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useFlashBatchQueue } from "@/features/flasher/hooks/use-flash-batch-queue";
import { useFlasherActions } from "@/features/flasher/hooks/use-flasher-actions";
import { useFlasherDropTargets } from "@/features/flasher/hooks/use-flasher-drop-targets";
import { useFlasherTelemetry } from "@/features/flasher/hooks/use-flasher-telemetry";
import type { FlasherTab } from "@/features/flasher/model/flasher-types";
import { FlasherPartitionTab } from "@/features/flasher/partition/flasher-partition-tab";
import { FlasherSideloadTab } from "@/features/flasher/sideload/flasher-sideload-tab";
import { FlasherCockpitHero } from "@/features/flasher/ui/flasher-cockpit-hero";
import { FlasherConfirmations } from "@/features/flasher/ui/flasher-confirmations";
import { FlasherWipeTab } from "@/features/flasher/wipe/flasher-wipe-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

export const ViewFlasher = ({ initialTab = "partition" }: { initialTab?: FlasherTab } = {}) => {
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

  const handleRebootFastboot = useCallback(() => {
    void rebootDevice("fastboot");
  }, [rebootDevice]);

  const handleRebootRecovery = useCallback(() => {
    void rebootDevice("recovery");
  }, [rebootDevice]);

  const handleRebootSystem = useCallback(() => {
    void rebootDevice("system");
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

      {/* ── 3-Tab Hardware Navigation ────────────────────────────────── */}
      <Tabs
        className="flex flex-col gap-4"
        onValueChange={(v) => setActiveTab(v as FlasherTab)}
        value={activeTab}
      >
        <TabsList className="bg-surface-raised w-full p-1">
          <TabsTrigger className="text-caption flex-1 gap-2 font-medium" value="partition">
            <HardDrive className="size-4" />
            <span>Partition Flasher</span>
          </TabsTrigger>

          <TabsTrigger className="text-caption flex-1 gap-2 font-medium" value="sideload">
            <Package className="size-4" />
            <span>Recovery Sideload</span>
          </TabsTrigger>

          <TabsTrigger className="text-caption flex-1 gap-2 font-medium" value="wipe">
            <Trash2 className="size-4" />
            <span>Partitions & Wipe</span>
          </TabsTrigger>
        </TabsList>

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
            onExecuteBatch={() => {
              void executeBatch(selectedFastbootSerial);
            }}
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
            isLoading={loadingAction === "wipe"}
            onWipeData={() => {
              void handleWipe();
            }}
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
};
