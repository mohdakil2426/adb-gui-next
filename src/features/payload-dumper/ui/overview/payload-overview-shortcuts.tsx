import { ArrowRight, History, Layers, Sparkles, Store } from "lucide-react";

import type { PayloadTabType } from "@/features/payload-dumper/payload-dumper-view";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";

interface PayloadOverviewShortcutsProps {
  onNavigateTab: (tab: PayloadTabType) => void;
}

export const PayloadOverviewShortcuts = ({ onNavigateTab }: PayloadOverviewShortcutsProps) => (
  <div>
    <div className="mb-3 flex items-center justify-between">
      <div>
        <h2 className="text-foreground text-title font-semibold">Workflow Shortcuts</h2>
        <p className="text-caption text-muted-foreground">
          Jump directly to core payload dumper workspaces
        </p>
      </div>
      <Badge variant="outline">
        <Sparkles className="text-primary mr-1 size-3" />
        Quick Navigation
      </Badge>
    </div>

    <div className="grid grid-cols-1 gap-3.5 @sm:grid-cols-2 @lg:grid-cols-3">
      <Card
        className="group border-border bg-surface hover:border-primary/50 hover:bg-surface-raised/40 relative cursor-pointer rounded-xl transition-[border-color,background-color,box-shadow] duration-150 hover:shadow-sm"
        onClick={() => onNavigateTab("extractor")}
      >
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="border-border bg-surface-raised text-primary group-hover:border-primary/40 group-hover:bg-primary/10 flex size-9 items-center justify-center rounded-lg border transition-colors">
                <Layers className="size-4.5" />
              </div>
              <Badge variant="secondary">Extractor</Badge>
            </div>
            <div>
              <h3 className="text-body text-foreground group-hover:text-primary font-semibold">
                Partition Extractor
              </h3>
              <p className="text-caption text-muted-foreground mt-1 leading-relaxed">
                Load local files or remote URLs, filter, and extract specific partition images (
                <code className="text-[11px]">boot</code>,{" "}
                <code className="text-[11px]">init_boot</code>,{" "}
                <code className="text-[11px]">vbmeta</code>,{" "}
                <code className="text-[11px]">system</code>).
              </p>
            </div>
          </div>
          <div className="text-caption text-primary mt-4 flex items-center gap-1.5 font-medium">
            <span>Open Extractor</span>
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>

      <Card
        className="group border-border bg-surface hover:border-primary/50 hover:bg-surface-raised/40 relative cursor-pointer rounded-xl transition-[border-color,background-color,box-shadow] duration-150 hover:shadow-sm"
        onClick={() => onNavigateTab("marketplace")}
      >
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="border-border bg-surface-raised text-primary group-hover:border-primary/40 group-hover:bg-primary/10 flex size-9 items-center justify-center rounded-lg border transition-colors">
                <Store className="size-4.5" />
              </div>
              <Badge className="border-primary/20 bg-primary/10 text-primary" variant="outline">
                Catalog
              </Badge>
            </div>
            <div>
              <h3 className="text-body text-foreground group-hover:text-primary font-semibold">
                Firmware Hub
              </h3>
              <p className="text-caption text-muted-foreground mt-1 leading-relaxed">
                Explore official Google Pixel, Xiaomi, Nothing & POCO OTA & Factory builds.
              </p>
            </div>
          </div>
          <div className="text-caption text-primary mt-4 flex items-center gap-1.5 font-medium">
            <span>Open Catalog</span>
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>

      <Card
        className="group border-border bg-surface hover:border-primary/50 hover:bg-surface-raised/40 relative cursor-pointer rounded-xl transition-[border-color,background-color,box-shadow] duration-150 hover:shadow-sm"
        onClick={() => onNavigateTab("history")}
      >
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="border-border bg-surface-raised text-primary group-hover:border-primary/40 group-hover:bg-primary/10 flex size-9 items-center justify-center rounded-lg border transition-colors">
                <History className="size-4.5" />
              </div>
              <Badge variant="secondary">Outputs</Badge>
            </div>
            <div>
              <h3 className="text-body text-foreground group-hover:text-primary font-semibold">
                Extracted Outputs & History
              </h3>
              <p className="text-caption text-muted-foreground mt-1 leading-relaxed">
                View extracted image files, reveal destination folders in file explorer, and review
                past extraction jobs.
              </p>
            </div>
          </div>
          <div className="text-caption text-primary mt-4 flex items-center gap-1.5 font-medium">
            <span>View Output History</span>
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);
