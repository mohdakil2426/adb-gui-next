import { BarChart3, FileUp, Loader2, Package, ShieldCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useInstalledPackages } from '@/features/app-manager/debloater/hooks/useInstalledPackages';
import {
  type AppManagerTab,
  useDebloatStore,
} from '@/features/app-manager/debloater/model/debloatStore';
import { useInstallationStore } from '@/features/app-manager/debloater/model/installationStore';
import { DebloaterTab } from '@/features/app-manager/debloater/ui/DebloaterTab';
import { InstallationTab } from '@/features/app-manager/debloater/ui/InstallationTab';
import { InstalledAppsTab } from '@/features/app-manager/debloater/ui/InstalledAppsTab';
import { PackageInspectorDrawer } from '@/features/app-manager/inspector/PackageInspectorDrawer';
import { AppOverviewTab } from '@/features/app-manager/overview/AppOverviewTab';
import { Card, CardContent } from '@/shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export function AppManagerView({ activeView }: { activeView: string }) {
  const activeTab = useDebloatStore((s) => s.activeTab);
  const setActiveTab = useDebloatStore((s) => s.setActiveTab);
  const isLoadingDebloat = useDebloatStore((s) => s.isLoadingPackages);
  const debloatPackages = useDebloatStore((s) => s.packages);
  const installedPackages = useInstallationStore((s) => s.packages);

  const [inspectedPackage, setInspectedPackage] = useState<string | null>(null);

  const {
    error: packagesError,
    hasLoaded,
    isLoading,
    refresh,
    selectedSerial,
  } = useInstalledPackages();

  void activeView;

  const openDebloat = useCallback(() => {
    setActiveTab('debloater');
  }, [setActiveTab]);

  const handleInspectApp = useCallback((packageName: string) => {
    setInspectedPackage(packageName);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Applications</h1>

      <Card className="gap-0 rounded-lg border-border bg-surface py-0 shadow-none">
        <CardContent className="p-4">
          <Tabs
            className="w-full gap-4"
            onValueChange={(v) => {
              setActiveTab(v as AppManagerTab);
            }}
            value={activeTab || 'overview'}
          >
            <TabsList>
              <TabsTrigger value="overview">
                <BarChart3 aria-hidden="true" />
                Overview
              </TabsTrigger>

              <TabsTrigger value="installed">
                <Package aria-hidden="true" />
                Installed apps
                {isLoading ? (
                  <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                ) : (
                  <span className="numeric text-caption text-muted-foreground">
                    {installedPackages.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger value="installation">
                <FileUp aria-hidden="true" />
                Install
              </TabsTrigger>

              <TabsTrigger value="debloater">
                <ShieldCheck aria-hidden="true" />
                Debloat
                {isLoadingDebloat ? (
                  <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <AppOverviewTab
                debloatPackages={debloatPackages}
                installedPackages={installedPackages}
                onOpenDebloat={openDebloat}
                onSelectApp={handleInspectApp}
                selectedSerial={selectedSerial}
              />
            </TabsContent>

            <TabsContent value="installed">
              <InstalledAppsTab
                hasLoaded={hasLoaded}
                loadError={packagesError}
                onInspect={handleInspectApp}
                onRefresh={refresh}
              />
            </TabsContent>

            <TabsContent value="installation">
              <InstallationTab onInstalled={refresh} />
            </TabsContent>

            <TabsContent value="debloater">
              <DebloaterTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Slide-out Deep Package Inspector Drawer */}
      <PackageInspectorDrawer
        onClose={() => setInspectedPackage(null)}
        onRefresh={refresh}
        packageName={inspectedPackage}
        selectedSerial={selectedSerial}
      />
    </div>
  );
}
