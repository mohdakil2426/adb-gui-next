import { Loader2, Package, X } from "lucide-react";

import { SideloadHelperActions } from "@/features/flasher/sideload/sideload-helper-actions";
import { SideloadProgressCard } from "@/features/flasher/sideload/sideload-progress-card";
import { DeviceGate } from "@/features/flasher/ui/device-gate";
import { DropArea } from "@/features/flasher/ui/drop-area";
import { FileSelector } from "@/shared/components/file-selector";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { getFileName } from "@/shared/utils/file-path";

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

export const FlasherSideloadTab = ({
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
}: FlasherSideloadTabProps) => {
  const fileName = sideloadFilePath ? getFileName(sideloadFilePath) : "";
  const isSideloading = loadingAction === "sideload";

  return (
    <div className="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-2">
      {/* ── Left Column: Primary Sideload Package Card ───────────────── */}
      <div className="flex" ref={sideloadSectionRef}>
        <Card className="border-border bg-surface flex h-full w-full flex-col justify-between rounded-xl shadow-none">
          <div className="flex flex-1 flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-title flex items-center gap-2">
                  <Package className="text-muted-foreground size-5" />
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
                            onClick={() => setSideloadFilePath("")}
                            size="icon"
                            variant="ghost"
                          >
                            <X className="size-4" data-icon="inline-start" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear selection</TooltipContent>
                      </Tooltip>
                    }
                  />

                  <div className="border-border/60 bg-surface-raised/40 text-caption flex items-center justify-between rounded-md border px-3 py-1.5">
                    <span className="text-muted-foreground">
                      Package: <span className="text-foreground font-mono">{fileName}</span>
                    </span>
                    <Badge variant="outline">ZIP Format</Badge>
                  </div>
                </div>
              ) : (
                <DropArea
                  browseLabel="Browse ZIP"
                  disabled={isGlobalLoading}
                  icon={Package}
                  isDragging={dragTarget === "sideload"}
                  label="Drop a flashable ZIP here"
                  onBrowse={onSelectSideloadFile}
                  sublabel="Accepted: .zip OTA and ROM packages"
                />
              )}

              <div className="border-border/70 bg-background/50 text-caption text-muted-foreground rounded-lg border p-3">
                <p className="text-foreground font-semibold">Sideload Process Overview:</p>
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
                <Loader2 className="mr-2 size-4 shrink-0 animate-spin" data-icon="inline-start" />
              ) : (
                <Package className="mr-2 size-4 shrink-0" data-icon="inline-start" />
              )}
              Sideload Package {fileName ? `(${fileName})` : ""}
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
};
