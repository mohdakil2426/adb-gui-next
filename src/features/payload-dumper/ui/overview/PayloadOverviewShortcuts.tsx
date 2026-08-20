import { ArrowRight, History, Layers, Sparkles, Store } from 'lucide-react';
import type { PayloadTabType } from '@/features/payload-dumper/PayloadDumperView';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';

interface PayloadOverviewShortcutsProps {
  onNavigateTab: (tab: PayloadTabType) => void;
}

export function PayloadOverviewShortcuts({ onNavigateTab }: PayloadOverviewShortcutsProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground text-title">Workflow Shortcuts</h2>
          <p className="text-caption text-muted-foreground">
            Jump directly to core payload dumper workspaces
          </p>
        </div>
        <Badge variant="outline">
          <Sparkles className="mr-1 size-3 text-primary" />
          Quick Navigation
        </Badge>
      </div>

      <div className="grid @lg:grid-cols-3 @sm:grid-cols-2 grid-cols-1 gap-3.5">
        <Card
          className="group relative cursor-pointer rounded-xl border-border bg-surface transition-[border-color,background-color,box-shadow] duration-150 hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-sm"
          onClick={() => onNavigateTab('extractor')}
        >
          <CardContent className="flex h-full flex-col justify-between p-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                  <Layers className="size-4.5" />
                </div>
                <Badge variant="secondary">Extractor</Badge>
              </div>
              <div>
                <h3 className="font-semibold text-body text-foreground group-hover:text-primary">
                  Partition Extractor
                </h3>
                <p className="mt-1 text-caption text-muted-foreground leading-relaxed">
                  Load local files or remote URLs, filter, and extract specific partition images (
                  <code className="text-[11px]">boot</code>,{' '}
                  <code className="text-[11px]">init_boot</code>,{' '}
                  <code className="text-[11px]">vbmeta</code>,{' '}
                  <code className="text-[11px]">system</code>).
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 font-medium text-caption text-primary">
              <span>Open Extractor</span>
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="group relative cursor-pointer rounded-xl border-border bg-surface transition-[border-color,background-color,box-shadow] duration-150 hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-sm"
          onClick={() => onNavigateTab('marketplace')}
        >
          <CardContent className="flex h-full flex-col justify-between p-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                  <Store className="size-4.5" />
                </div>
                <Badge className="border-primary/20 bg-primary/10 text-primary" variant="outline">
                  Catalog
                </Badge>
              </div>
              <div>
                <h3 className="font-semibold text-body text-foreground group-hover:text-primary">
                  Firmware Hub
                </h3>
                <p className="mt-1 text-caption text-muted-foreground leading-relaxed">
                  Explore official Google Pixel, Xiaomi, Nothing & POCO OTA & Factory builds.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 font-medium text-caption text-primary">
              <span>Open Catalog</span>
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="group relative cursor-pointer rounded-xl border-border bg-surface transition-[border-color,background-color,box-shadow] duration-150 hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-sm"
          onClick={() => onNavigateTab('history')}
        >
          <CardContent className="flex h-full flex-col justify-between p-4">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                  <History className="size-4.5" />
                </div>
                <Badge variant="secondary">Outputs</Badge>
              </div>
              <div>
                <h3 className="font-semibold text-body text-foreground group-hover:text-primary">
                  Extracted Outputs & History
                </h3>
                <p className="mt-1 text-caption text-muted-foreground leading-relaxed">
                  View extracted image files, reveal destination folders in file explorer, and
                  review past extraction jobs.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 font-medium text-caption text-primary">
              <span>View Output History</span>
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
