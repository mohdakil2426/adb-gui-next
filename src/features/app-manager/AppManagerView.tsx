import { FileUp, Loader2, Package, ShieldCheck } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useInstalledPackages } from '@/features/app-manager/debloater/hooks/useInstalledPackages';
import {
  type AppManagerTab,
  useDebloatStore,
} from '@/features/app-manager/debloater/model/debloatStore';
import { useInstallationStore } from '@/features/app-manager/debloater/model/installationStore';
import { computePackageComposition } from '@/features/app-manager/debloater/model/packageComposition';
import { DebloaterTab } from '@/features/app-manager/debloater/ui/DebloaterTab';
import { InstallationTab } from '@/features/app-manager/debloater/ui/InstallationTab';
import { InstalledAppsTab } from '@/features/app-manager/debloater/ui/InstalledAppsTab';
import { PackageCompositionPanel } from '@/features/app-manager/debloater/ui/PackageCompositionPanel';
import { Card, CardContent } from '@/shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export function AppManagerView({ activeView }: { activeView: string }) {
  const activeTab = useDebloatStore((s) => s.activeTab);
  const setActiveTab = useDebloatStore((s) => s.setActiveTab);
  const isLoadingDebloat = useDebloatStore((s) => s.isLoadingPackages);
  const debloatPackages = useDebloatStore((s) => s.packages);
  const installedPackages = useInstallationStore((s) => s.packages);

  // Owned here, not in a tab: the composition summary needs the package list
  // whichever tab is open, and two callers would double the `pm list` call.
  const {
    error: packagesError,
    hasLoaded,
    isLoading,
    refresh,
    selectedSerial,
  } = useInstalledPackages();

  // Re-export activeView for auto-load triggers in child tabs
  void activeView;

  const composition = useMemo(
    () => computePackageComposition(installedPackages, debloatPackages),
    [debloatPackages, installedPackages],
  );

  const openDebloat = useCallback(() => {
    setActiveTab('debloater');
  }, [setActiveTab]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Applications</h1>

      <PackageCompositionPanel
        composition={composition}
        hasDebloatData={debloatPackages.length > 0}
        isLoading={isLoading}
        loadError={packagesError}
        onOpenDebloat={openDebloat}
        selectedSerial={selectedSerial}
      />

      <Card className="gap-0 rounded-lg border-border bg-surface py-0 shadow-none">
        <CardContent className="p-4">
          <Tabs
            className="w-full gap-4"
            onValueChange={(v) => {
              setActiveTab(v as AppManagerTab);
            }}
            value={activeTab}
          >
            <TabsList>
              <TabsTrigger value="installation">
                <FileUp aria-hidden="true" />
                Install
              </TabsTrigger>
              <TabsTrigger value="installed">
                <Package aria-hidden="true" />
                Installed apps
                {isLoading ? (
                  <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                ) : (
                  <span className="numeric text-caption text-muted-foreground">
                    {composition.total}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="debloater">
                <ShieldCheck aria-hidden="true" />
                Debloat
                {isLoadingDebloat ? (
                  <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="installation">
              <InstallationTab onInstalled={refresh} />
            </TabsContent>

            <TabsContent value="installed">
              <InstalledAppsTab
                hasLoaded={hasLoaded}
                loadError={packagesError}
                onRefresh={refresh}
              />
            </TabsContent>

            <TabsContent value="debloater">
              <DebloaterTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
