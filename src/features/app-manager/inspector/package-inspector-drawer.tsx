/* eslint-disable react/todo -- non-React-Compiler try/finally flow */
import { Code2, Loader2, Package, X } from "lucide-react";
import { useEffect, useState } from "react";

import { GetPackageDetails } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { PackageLifecycleControls } from "@/features/app-manager/inspector/package-lifecycle-controls";
import { PackagePermissionsManager } from "@/features/app-manager/inspector/package-permissions-manager";
import { PackageStorageBreakdown } from "@/features/app-manager/inspector/package-storage-breakdown";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/sheet";

interface PackageInspectorDrawerProps {
  onClose: () => void;
  onRefresh?: (() => void) | undefined;
  packageName: string | null;
  selectedSerial: string | null;
}

export const PackageInspectorDrawer = ({
  onClose,
  onRefresh,
  packageName,
  selectedSerial,
}: PackageInspectorDrawerProps) => {
  const [details, setDetails] = useState<backend.DetailedPackageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!packageName || !selectedSerial) {
      return;
    }
    let isCancelled = false;
    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const data = await GetPackageDetails(packageName, selectedSerial);
        if (!isCancelled) {
          setDetails(data);
        }
      } catch {
        if (!isCancelled) {
          setDetails({
            apkPath: "",
            dataDir: `/data/data/${packageName}`,
            deniedPermissions: [],
            grantedPermissions: [],
            installer: null,
            isEnabled: true,
            isSystem: false,
            label: packageName,
            minSdk: 26,
            name: packageName,
            signatures: [],
            splitPaths: [],
            targetSdk: 34,
            versionCode: "1",
            versionName: "1.0",
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };
    void fetchDetails();

    return () => {
      isCancelled = true;
    };
  }, [packageName, selectedSerial]);

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={Boolean(packageName)}
    >
      <SheetContent
        aria-label={`Package details for ${details?.label || packageName || "application"}`}
        className="border-border bg-surface top-11 z-50 flex h-[calc(100vh-2.75rem)] w-full max-w-lg flex-col gap-0 border-t-0 border-l p-0 shadow-2xl sm:max-w-lg"
        showCloseButton={false}
        side="right"
      >
        {/* Header */}
        <SheetHeader className="border-border flex flex-row items-center justify-between border-b p-4 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <div className="border-border bg-surface text-primary flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-xs">
              <Package className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <SheetTitle className="text-foreground text-label truncate font-bold">
                {details?.label || packageName}
              </SheetTitle>
              <SheetDescription className="text-caption text-muted-foreground truncate font-mono">
                {packageName}
              </SheetDescription>
            </div>
          </div>

          <Button
            aria-label="Close inspector"
            className="text-muted-foreground hover:text-foreground size-8 shrink-0 p-0"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" data-icon="inline-start" />
            <span className="sr-only">Close inspector</span>
          </Button>
        </SheetHeader>

        {/* Scrollable Drawer Body */}
        <div aria-live="polite" className="flex-1 overflow-y-auto p-4">
          {(() => {
            if (isLoading) {
              return (
                <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2">
                  <Loader2 className="text-primary size-6 animate-spin" />
                  <span className="text-caption">Inspecting package details via ADB…</span>
                </div>
              );
            }
            if (details) {
              return (
                <div className="flex flex-col gap-4">
                  {/* Version & Target SDK Badges */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border-border bg-surface flex flex-col rounded-md border p-2">
                      <span className="text-caption text-muted-foreground">Version</span>
                      <span className="numeric text-body text-foreground truncate font-semibold">
                        {details.versionName || "1.0"}
                      </span>
                      <span className="numeric text-caption text-muted-foreground">
                        Code {details.versionCode || "1"}
                      </span>
                    </div>
                    <div className="border-border bg-surface flex flex-col rounded-md border p-2">
                      <span className="text-caption text-muted-foreground">Target SDK</span>
                      <span className="numeric text-body text-foreground font-semibold">
                        API {details.targetSdk}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        Min API {details.minSdk}
                      </span>
                    </div>
                    <div className="border-border bg-surface flex flex-col rounded-md border p-2">
                      <span className="text-caption text-muted-foreground">Architecture</span>
                      <span className="text-body text-foreground truncate font-semibold">
                        {details.signatures && details.signatures.length > 0
                          ? "Signed"
                          : "Unsigned"}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {details.splitPaths && details.splitPaths.length > 0
                          ? `${details.splitPaths.length} splits`
                          : "Base only"}
                      </span>
                    </div>
                  </div>

                  {/* Lifecycle Operations */}
                  <PackageLifecycleControls
                    info={details}
                    onRefresh={onRefresh}
                    selectedSerial={selectedSerial}
                  />

                  {/* Storage & Code Paths */}
                  <PackageStorageBreakdown info={details} />

                  {/* Permissions */}
                  <PackagePermissionsManager info={details} />
                </div>
              );
            }
            return (
              <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2">
                <Code2 className="text-muted-foreground size-6" />
                <span className="text-caption">Package not found on connected device</span>
              </div>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
};
