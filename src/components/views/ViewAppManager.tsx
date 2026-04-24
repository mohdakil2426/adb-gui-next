import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DebloaterTab } from './debloater/DebloaterTab';
import { InstallationTab } from './debloater/InstallationTab';
import { useDebloatStore } from '@/lib/debloatStore';

type AppManagerTab = 'debloater' | 'installation';

export function ViewAppManager({ activeView }: { activeView: string }) {
  const [activeTab, setActiveTab] = useState<AppManagerTab>('debloater');
  const isLoadingPackages = useDebloatStore((s) => s.isLoadingPackages);

  // Re-export activeView for auto-load triggers in child tabs
  void activeView;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary">
            <Package className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Applications</h1>
            <p className="text-sm text-muted-foreground">
              Manage, debloat, and install apps on your device.
            </p>
          </div>
        </div>
      </div>

      {/* ── Card with flush tabs ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AppManagerTab)}>
            <TabsList
              variant="line"
              className="w-full justify-start rounded-none rounded-t-xl border-b px-4"
            >
              <TabsTrigger value="debloater" className="flex items-center gap-1.5">
                <ShieldCheck className={cn('size-3.5', isLoadingPackages && 'animate-spin')} />
                Debloater
              </TabsTrigger>
              <TabsTrigger value="installation" className="flex items-center gap-1.5">
                <Package className="size-3.5" />
                Installation
              </TabsTrigger>
            </TabsList>

            <div className="p-6">
              <TabsContent value="debloater">
                <DebloaterTab />
              </TabsContent>

              <TabsContent value="installation">
                <InstallationTab />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
