import { Clock, FileUp, HardDrive, Loader2, Package, X } from 'lucide-react';
import { useRef } from 'react';
import { useFlasherActions } from '@/features/flasher/hooks/useFlasherActions';
import { useFlasherDropTargets } from '@/features/flasher/hooks/useFlasherDropTargets';
import { DangerZoneCard } from '@/features/flasher/ui/DangerZoneCard';
import { DropArea } from '@/features/flasher/ui/DropArea';
import { FileSelector } from '@/shared/components/FileSelector';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

const COMMON_PARTITIONS = [
  'boot',
  'vendor_boot',
  'init_boot',
  'recovery',
  'dtbo',
  'vbmeta',
  'vbmeta_system',
  'vbmeta_vendor',
  'system',
  'vendor',
  'product',
  'system_ext',
  'super',
  'modem',
  'radio',
  'persist',
  'metadata',
  'cache',
  'userdata',
] as const;

export function ViewFlasher() {
  const {
    filePath,
    handleFlash,
    handleSelectImageFile,
    handleSelectSideloadFile,
    handleSideload,
    handleWipe,
    isGlobalLoading,
    loadingAction,
    partition,
    queuedAction,
    selectedFastbootSerial,
    setFilePath,
    setPartition,
    setQueuedAction,
    setSideloadFilePath,
    sideloadFilePath,
  } = useFlasherActions();

  // Refs for position-based hit-testing
  const flashSectionRef = useRef<HTMLDivElement>(null);
  const sideloadSectionRef = useRef<HTMLDivElement>(null);

  const { dragTarget } = useFlasherDropTargets({
    flashSectionRef,
    setFilePath,
    setSideloadFilePath,
    sideloadSectionRef,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Flasher</h1>

      {/* Side-by-Side Grid for Primary Flasher Tools */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        {/* ── Flash Partition ─────────────────────────────────────────── */}
        <div className="flex" ref={flashSectionRef}>
          <Card className="flex h-full w-full flex-col justify-between">
            <div className="flex flex-1 flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="size-5" />
                  Flash Partition
                </CardTitle>
                <CardDescription>
                  Flash an image file to a device partition via fastboot.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="flasher-partition">Partition Name</FieldLabel>
                  <Input
                    disabled={isGlobalLoading}
                    id="flasher-partition"
                    list="partition-suggestions"
                    onChange={(e) => {
                      setPartition(e.target.value);
                    }}
                    placeholder="e.g., boot, recovery, vendor_boot"
                    value={partition}
                  />
                  <FieldDescription>
                    Choose a fastboot partition name or type a custom one.
                  </FieldDescription>
                  <datalist id="partition-suggestions">
                    {COMMON_PARTITIONS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </Field>

                {filePath ? (
                  <FileSelector
                    disabled={isGlobalLoading}
                    icon={<FileUp className="size-4" />}
                    label="Image File"
                    onSelect={handleSelectImageFile}
                    path={filePath}
                    trailingAction={
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            disabled={isGlobalLoading}
                            onClick={() => {
                              setFilePath('');
                              if (queuedAction?.type === 'flash') {
                                setQueuedAction(null);
                              }
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            <X className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear selection</TooltipContent>
                      </Tooltip>
                    }
                  />
                ) : (
                  <DropArea
                    browseLabel="Browse Image"
                    disabled={isGlobalLoading}
                    icon={FileUp}
                    isDragging={dragTarget === 'flash'}
                    label="Drop an image file here"
                    onBrowse={handleSelectImageFile}
                    sublabel="Accepted: .img files only"
                  />
                )}
              </CardContent>
            </div>

            <div className="px-6 pt-2 pb-6">
              <Button
                className="w-full"
                disabled={isGlobalLoading || !partition || !filePath}
                onClick={handleFlash}
              >
                {loadingAction === 'flash' ? (
                  <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                ) : queuedAction?.type === 'flash' ? (
                  <Clock className="mr-2 size-4 shrink-0" />
                ) : (
                  <FileUp className="mr-2 size-4 shrink-0" />
                )}
                {queuedAction?.type === 'flash' && loadingAction !== 'flash'
                  ? 'Waiting for Device...'
                  : 'Flash Partition'}
              </Button>
            </div>
          </Card>
        </div>

        {/* ── Recovery Sideload ───────────────────────────────────────── */}
        <div className="flex" ref={sideloadSectionRef}>
          <Card className="flex h-full w-full flex-col justify-between">
            <div className="flex flex-1 flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-5" />
                  Recovery Sideload
                </CardTitle>
                <CardDescription>
                  Send a flashable ZIP via adb sideload while your device is in recovery.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex-grow" />
                {sideloadFilePath ? (
                  <FileSelector
                    disabled={isGlobalLoading}
                    icon={<Package className="size-4" />}
                    label="Flashable ZIP"
                    onSelect={handleSelectSideloadFile}
                    path={sideloadFilePath}
                    placeholder="Select a flashable .zip file..."
                    trailingAction={
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            disabled={isGlobalLoading}
                            onClick={() => {
                              setSideloadFilePath('');
                              if (queuedAction?.type === 'sideload') {
                                setQueuedAction(null);
                              }
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            <X className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear selection</TooltipContent>
                      </Tooltip>
                    }
                  />
                ) : (
                  <DropArea
                    browseLabel="Browse ZIP"
                    disabled={isGlobalLoading}
                    icon={Package}
                    isDragging={dragTarget === 'sideload'}
                    label="Drop a flashable ZIP here"
                    onBrowse={handleSelectSideloadFile}
                    sublabel="Accepted: .zip files only"
                  />
                )}

                <div className="min-h-4 flex-grow" />

                <p className="text-muted-foreground text-sm">
                  Ensure the device shows &quot;sideload&quot; mode in recovery before starting.
                </p>
              </CardContent>
            </div>

            <div className="px-6 pt-2 pb-6">
              <Button
                className="w-full"
                disabled={isGlobalLoading || !sideloadFilePath}
                onClick={handleSideload}
              >
                {loadingAction === 'sideload' ? (
                  <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                ) : queuedAction?.type === 'sideload' ? (
                  <Clock className="mr-2 size-4 shrink-0" />
                ) : (
                  <Package className="mr-2 size-4 shrink-0" />
                )}
                {queuedAction?.type === 'sideload' && loadingAction !== 'sideload'
                  ? 'Waiting for Device...'
                  : 'Sideload Package'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <DangerZoneCard
        disabled={isGlobalLoading || !selectedFastbootSerial}
        isLoading={loadingAction === 'wipe'}
        onWipe={() => {
          void handleWipe();
        }}
      />
    </div>
  );
}
