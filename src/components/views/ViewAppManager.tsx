import { Package, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type AppManagerTab, useDebloatStore } from "@/lib/debloatStore";
import { cn } from "@/lib/utils";
import { DebloaterTab } from "./debloater/DebloaterTab";
import { InstallationTab } from "./debloater/InstallationTab";

export function ViewAppManager({ activeView }: { activeView: string }) {
  const activeTab = useDebloatStore((s) => s.activeTab);
  const setActiveTab = useDebloatStore((s) => s.setActiveTab);
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
            <h1 className="sr-only">Applications</h1>
            <p className="text-muted-foreground text-sm">
              Manage, debloat, and install apps on your device.
            </p>
          </div>
        </div>
      </div>

      {/* ── Card with flush tabs ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Tabs
            onValueChange={(v) => {
              setActiveTab(v as AppManagerTab);
            }}
            value={activeTab}
          >
            <TabsList
              className="w-full justify-start rounded-none rounded-t-xl border-b px-4"
              variant="line"
            >
              <TabsTrigger
                className="flex items-center gap-1.5"
                value="installation"
              >
                <Package className="size-3.5" />
                Installation
              </TabsTrigger>
              <TabsTrigger
                className="flex items-center gap-1.5"
                value="debloater"
              >
                <ShieldCheck
                  className={cn(
                    "size-3.5",
                    isLoadingPackages && "animate-spin"
                  )}
                />
                Debloater
              </TabsTrigger>
            </TabsList>

            <div className="p-6">
              <TabsContent value="installation">
                <InstallationTab />
              </TabsContent>

              <TabsContent value="debloater">
                <DebloaterTab />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
