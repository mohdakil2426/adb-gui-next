import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
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
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export function AppManagerView({ activeView }: { activeView: string }) {
  const activeTab = useDebloatStore((s) => s.activeTab);
  const setActiveTab = useDebloatStore((s) => s.setActiveTab);
  const isLoadingDebloat = useDebloatStore((s) => s.isLoadingPackages);
  const debloatPackages = useDebloatStore((s) => s.packages);
  const installedPackages = useInstallationStore((s) => s.packages);
  const shouldReduceMotion = useReducedMotion();

  const [inspectedPackage, setInspectedPackage] = useState<string | null>(null);

  const { error: packagesError, hasLoaded, refresh, selectedSerial } = useInstalledPackages();

  void activeView;

  const openDebloat = useCallback(() => {
    setActiveTab('debloater');
  }, [setActiveTab]);

  const handleInspectApp = useCallback((packageName: string) => {
    setInspectedPackage(packageName);
  }, []);

  const currentTab = (activeTab || 'overview') as AppManagerTab;

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
            value={currentTab}
          >
            <TabsList>
              <TabsTrigger value="overview">
                <BarChart3 aria-hidden="true" />
                Overview
              </TabsTrigger>

              <TabsTrigger value="installed">
                <Package aria-hidden="true" />
                Installed apps
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

            <AnimatePresence mode="wait">
              <m.div
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 4 }}
                key={currentTab}
                transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
              >
                {currentTab === 'overview' && (
                  <AppOverviewTab
                    debloatPackages={debloatPackages}
                    installedPackages={installedPackages}
                    onOpenDebloat={openDebloat}
                    onSelectApp={handleInspectApp}
                    selectedSerial={selectedSerial}
                  />
                )}
                {currentTab === 'installed' && (
                  <InstalledAppsTab
                    hasLoaded={hasLoaded}
                    loadError={packagesError}
                    onInspect={handleInspectApp}
                    onRefresh={refresh}
                  />
                )}
                {currentTab === 'installation' && <InstallationTab onInstalled={refresh} />}
                {currentTab === 'debloater' && <DebloaterTab />}
              </m.div>
            </AnimatePresence>
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
