import { Loader2, Package, X } from 'lucide-react';
import { SideloadHelperActions } from '@/features/flasher/sideload/SideloadHelperActions';
import { SideloadProgressCard } from '@/features/flasher/sideload/SideloadProgressCard';
import { DeviceGate } from '@/features/flasher/ui/DeviceGate';
import { DropArea } from '@/features/flasher/ui/DropArea';
import { FileSelector } from '@/shared/components/FileSelector';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { getFileName } from '@/shared/utils/filePath';

interface FlasherSideloadTabProps {
  dragTarget: string;
  isGlobalLoading: boolean;
  loadingAction: string | null;
  onCheckSideloadState: () => void;
  onRebootRecovery: () => void;
  onRebootSystem: () => void;
  onSelectSideloadFile: () => void;
  requestSideload: () => void;
  selectedDeviceSerial: string | null;
  selectedSideloadSerial: string | null;
  setSideloadFilePath: (path: string) => void;
  sideloadFilePath: string;
  sideloadSectionRef: React.RefObject<HTMLDivElement | null>;
}

export function FlasherSideloadTab({
  sideloadFilePath,
  setSideloadFilePath,
  isGlobalLoading,
  loadingAction,
  selectedSideloadSerial,
  selectedDeviceSerial,
  onSelectSideloadFile,
  requestSideload,
  dragTarget,
  sideloadSectionRef,
  onRebootRecovery,
  onRebootSystem,
  onCheckSideloadState,
}: FlasherSideloadTabProps) {
  const fileName = sideloadFilePath ? getFileName(sideloadFilePath) : '';
  const isSideloading = loadingAction === 'sideload';

  return (
    <div className="grid @3xl:grid-cols-2 grid-cols-1 items-start gap-5">
      {/* ── Left Column: Primary Sideload Package Card ───────────────── */}
      <div className="flex" ref={sideloadSectionRef}>
        <Card className="flex h-full w-full flex-col justify-between rounded-xl border-border bg-surface shadow-none">
          <div className="flex flex-1 flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground text-title">
                  <Package className="size-5 text-muted-foreground" />
                  Recovery Sideload Studio
                </CardTitle>
                {selectedSideloadSerial ? (
                  <Badge className="font-mono text-[10px]" variant="success">
                    Recovery Ready
                  </Badge>
                ) : (
                  <Badge className="font-mono text-[10px]" variant="outline">
                    Awaiting Sideload Mode
                  </Badge>
                )}
              </div>
              <CardDescription className="text-caption">
                Stream an official OTA update package, custom ROM, or root ZIP over the ADB sideload
                protocol.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4">
              {/* File Selector or Drop Area */}
              {sideloadFilePath ? (
                <div className="flex flex-col gap-2">
                  <FileSelector
                    disabled={isGlobalLoading}
                    icon={<Package className="size-4" />}
                    label="Flashable ZIP Package"
                    onSelect={onSelectSideloadFile}
                    path={sideloadFilePath}
                    placeholder="Select a flashable .zip file..."
                    trailingAction={
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label="Clear selected flashable ZIP"
                            disabled={isGlobalLoading}
                            onClick={() => setSideloadFilePath('')}
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

                  <div className="flex items-center justify-between rounded-md border border-border/60 bg-surface-raised/40 px-3 py-1.5 text-caption">
                    <span className="text-muted-foreground">
                      Package: <span className="font-mono text-foreground">{fileName}</span>
                    </span>
                    <Badge variant="outline">ZIP Format</Badge>
                  </div>
                </div>
              ) : (
                <DropArea
                  browseLabel="Browse ZIP"
                  disabled={isGlobalLoading}
                  icon={Package}
                  isDragging={dragTarget === 'sideload'}
                  label="Drop a flashable ZIP here"
                  onBrowse={onSelectSideloadFile}
                  sublabel="Accepted: .zip OTA and ROM packages"
                />
              )}

              <div className="rounded-lg border border-border/70 bg-background/50 p-3 text-caption text-muted-foreground">
                <p className="font-semibold text-foreground">Sideload Process Overview:</p>
                <p className="mt-1">
                  Ensure the device screen shows &quot;Sideload&quot; or &quot;ADB Sideload&quot;
                  before pressing Sideload Package. The recovery updater binary will verify
                  signatures and apply delta blocks.
                </p>
              </div>
            </CardContent>
          </div>

          <div className="px-6 pt-2 pb-6">
            <Button
              className="w-full"
              disabled={isGlobalLoading || !sideloadFilePath || !selectedSideloadSerial}
              onClick={requestSideload}
              type="button"
            >
              {isSideloading ? (
                <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
              ) : (
                <Package className="mr-2 size-4 shrink-0" />
              )}
              Sideload Package {fileName ? `(${fileName})` : ''}
            </Button>

            {selectedSideloadSerial ? null : (
              <DeviceGate>
                Sideload needs the selected device in recovery with &quot;Apply update from
                ADB&quot; chosen on the device screen.
              </DeviceGate>
            )}
          </div>
        </Card>
      </div>

      {/* ── Right Column: Progress Pipeline & Helper Actions ─────────── */}
      <div className="flex flex-col gap-5">
        <SideloadProgressCard
          fileName={fileName}
          isSideloading={isSideloading}
          packagePath={sideloadFilePath}
        />

        <SideloadHelperActions
          disabled={isGlobalLoading}
          isSideloadActive={selectedSideloadSerial !== null}
          onCheckState={onCheckSideloadState}
          onRebootRecovery={onRebootRecovery}
          onRebootSystem={onRebootSystem}
          serial={selectedDeviceSerial}
        />
      </div>
    </div>
  );
}
