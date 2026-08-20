import { History, Search, TrendingUp } from 'lucide-react';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { CuratedPowerToolsGrid } from '@/features/marketplace/overview/CuratedPowerToolsGrid';
import { CategoryDistributionMeter } from '@/features/marketplace/overview/charts/CategoryDistributionMeter';
import { SourceCompositionDonut } from '@/features/marketplace/overview/charts/SourceCompositionDonut';
import { MarketplaceGuideCard } from '@/features/marketplace/overview/MarketplaceGuideCard';
import { Button } from '@/shared/ui/button';

type MarketplaceApp = backend.MarketplaceApp;

const QUICK_DISCOVERY_TAGS = [
  { label: 'Root & Magisk Modules', query: 'root' },
  { label: 'Terminal & CLI', query: 'terminal' },
  { label: 'Privacy & Security', query: 'privacy' },
  { label: 'Adblock & DNS', query: 'dns' },
  { label: 'Launchers & Customization', query: 'launcher' },
  { label: 'Password Managers', query: 'password' },
  { label: 'Audio & DSP Mods', query: 'audio' },
  { label: 'File & Cloud Storage', query: 'file manager' },
];

interface MarketplaceOverviewTabProps {
  onQuickSearch: (query: string) => void;
  onSelectApp: (app: MarketplaceApp) => void;
  target: InstallTarget;
}

export function MarketplaceOverviewTab({
  onQuickSearch,
  onSelectApp,
  target,
}: MarketplaceOverviewTabProps) {
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const setActiveTab = useMarketplaceStore((state) => state.setActiveTab);

  const handleChipClick = (query: string) => {
    onQuickSearch(query);
    setActiveTab('browse');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Quick Search & Popular Queries Bar */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <span className="font-semibold text-caption text-foreground uppercase tracking-wider">
              Instant Discovery & Popular Topics
            </span>
          </div>
          <span className="text-caption text-muted-foreground">Click tag to search catalog</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_DISCOVERY_TAGS.map((tag) => (
            <Button
              className="h-7 rounded-full border-border/80 bg-surface-raised/40 text-caption transition-colors hover:bg-accent hover:text-foreground"
              key={tag.label}
              onClick={() => handleChipClick(tag.query)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Search className="mr-1 size-3 text-muted-foreground" />
              {tag.label}
            </Button>
          ))}
        </div>

        {searchHistory.length > 0 && (
          <div className="flex items-center gap-2 border-border/40 border-t pt-1 text-caption text-muted-foreground">
            <History className="size-3.5 shrink-0" />
            <span className="font-medium text-foreground">Recent searches:</span>
            <div className="flex flex-wrap items-center gap-1">
              {searchHistory.slice(0, 5).map((term) => (
                <button
                  className="cursor-pointer rounded px-1.5 py-0.5 font-mono text-caption text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  key={term}
                  onClick={() => handleChipClick(term)}
                  type="button"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Symmetrical Charts Duo Grid */}
      <div className="grid @lg:grid-cols-2 grid-cols-1 gap-4">
        <SourceCompositionDonut />
        <CategoryDistributionMeter />
      </div>

      {/* Curated Power Tools Grid */}
      <CuratedPowerToolsGrid onSelectApp={onSelectApp} target={target} />

      {/* Security and Architecture Pipeline Guide */}
      <MarketplaceGuideCard />
    </div>
  );
}
