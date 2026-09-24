import { History, Search, TrendingUp } from "lucide-react";

import { useMarketplaceStore } from "@/features/marketplace/model/marketplace-store";
import { CategoryDistributionMeter } from "@/features/marketplace/overview/charts/category-distribution-meter";
import { SourceCompositionDonut } from "@/features/marketplace/overview/charts/source-composition-donut";
import { Button } from "@/shared/ui/button";

const QUICK_DISCOVERY_TAGS = [
  { label: "Root & Magisk Modules", query: "root" },
  { label: "Terminal & CLI", query: "terminal" },
  { label: "Privacy & Security", query: "privacy" },
  { label: "Adblock & DNS", query: "dns" },
  { label: "Launchers & Customization", query: "launcher" },
  { label: "Password Managers", query: "password" },
  { label: "Audio & DSP Mods", query: "audio" },
  { label: "File & Cloud Storage", query: "file manager" },
];

interface MarketplaceOverviewTabProps {
  onQuickSearch: (query: string) => void;
}

export const MarketplaceOverviewTab = ({ onQuickSearch }: MarketplaceOverviewTabProps) => {
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const setActiveTab = useMarketplaceStore((state) => state.setActiveTab);

  const handleChipClick = (query: string) => {
    onQuickSearch(query);
    setActiveTab("browse");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Quick Search & Popular Queries Bar */}
      <div className="border-border bg-surface flex flex-col gap-2.5 rounded-lg border p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary size-4" />
            <span className="text-caption text-foreground font-semibold tracking-wider uppercase">
              Instant Discovery & Popular Topics
            </span>
          </div>
          <span className="text-caption text-muted-foreground">Click tag to search catalog</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_DISCOVERY_TAGS.map((tag) => (
            <span className="inline-flex overflow-hidden rounded-full" key={tag.label}>
              <Button
                className="border-border/80 bg-surface-raised/40 text-caption hover:bg-accent hover:text-foreground h-7"
                onClick={() => handleChipClick(tag.query)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Search className="text-muted-foreground mr-1 size-3" data-icon="inline-start" />
                {tag.label}
              </Button>
            </span>
          ))}
        </div>

        {(searchHistory ?? []).length > 0 && (
          <div className="border-border/40 text-caption text-muted-foreground flex items-center gap-2 border-t pt-1">
            <History className="size-3.5 shrink-0" />
            <span className="text-foreground font-medium">Recent searches:</span>
            <div className="flex flex-wrap items-center gap-1">
              {(searchHistory ?? []).slice(0, 5).map((term) => (
                <button
                  className="text-caption text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer rounded px-1.5 py-0.5 font-mono transition-colors"
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
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <SourceCompositionDonut />
        <CategoryDistributionMeter />
      </div>
    </div>
  );
};
