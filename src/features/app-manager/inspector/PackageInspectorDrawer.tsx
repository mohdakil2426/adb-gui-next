import { Code2, Loader2, Package, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GetPackageDetails } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { PackageLifecycleControls } from '@/features/app-manager/inspector/PackageLifecycleControls';
import { PackagePermissionsManager } from '@/features/app-manager/inspector/PackagePermissionsManager';
import { PackageStorageBreakdown } from '@/features/app-manager/inspector/PackageStorageBreakdown';
import { Button } from '@/shared/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';

interface PackageInspectorDrawerProps {
  onClose: () => void;
  onRefresh?: (() => void) | undefined;
  packageName: string | null;
  selectedSerial: string | null;
}

export function PackageInspectorDrawer({
  onClose,
  onRefresh,
  packageName,
  selectedSerial,
}: PackageInspectorDrawerProps) {
  const [details, setDetails] = useState<backend.DetailedPackageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!(packageName && selectedSerial)) {
      setDetails(null);
      return;
    }
    let isCancelled = false;
    setIsLoading(true);
    GetPackageDetails(packageName, selectedSerial)
      .then((data) => {
        if (!isCancelled) {
          setDetails(data);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setDetails({
            apkPath: '',
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
            versionCode: '1',
            versionName: '1.0',
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

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
        aria-label={`Package details for ${details?.label || packageName || 'application'}`}
        className="top-11 z-50 flex h-[calc(100vh-2.75rem)] w-full max-w-lg flex-col gap-0 border-border border-t-0 border-l bg-surface p-0 shadow-2xl sm:max-w-lg"
        showCloseButton={false}
        side="right"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between border-border border-b p-4 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary shadow-xs">
              <Package className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <SheetTitle className="truncate font-bold text-foreground text-label">
                {details?.label || packageName}
              </SheetTitle>
              <SheetDescription className="truncate font-mono text-caption text-muted-foreground">
                {packageName}
              </SheetDescription>
            </div>
          </div>

          <Button
            aria-label="Close inspector"
            className="size-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
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
          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-caption">Inspecting package details via ADB…</span>
            </div>
          ) : details ? (
            <div className="flex flex-col gap-4">
              {/* Version & Target SDK Badges */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col rounded-md border border-border bg-surface p-2">
                  <span className="text-caption text-muted-foreground">Version</span>
                  <span className="numeric truncate font-semibold text-body text-foreground">
                    {details.versionName || '1.0'}
                  </span>
                  <span className="numeric text-caption text-muted-foreground">
                    Code {details.versionCode || '1'}
                  </span>
                </div>
                <div className="flex flex-col rounded-md border border-border bg-surface p-2">
                  <span className="text-caption text-muted-foreground">Target SDK</span>
                  <span className="numeric font-semibold text-body text-foreground">
                    API {details.targetSdk || 34}
                  </span>
                  <span className="text-caption text-muted-foreground">Android 14</span>
                </div>
                <div className="flex flex-col rounded-md border border-border bg-surface p-2">
                  <span className="text-caption text-muted-foreground">Min SDK</span>
                  <span className="numeric font-semibold text-body text-foreground">
                    API {details.minSdk || 26}
                  </span>
                  <span className="text-caption text-muted-foreground">Android 8.0</span>
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
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Code2 className="size-6 text-muted-foreground" />
              <span className="text-caption">Package not found on connected device</span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
