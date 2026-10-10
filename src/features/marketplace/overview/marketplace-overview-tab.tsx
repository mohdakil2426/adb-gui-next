import {
  ArrowUpRight,
  Flame,
  FolderArchive,
  Headphones,
  History,
  KeyRound,
  LayoutGrid,
  Search,
  Shield,
  ShieldCheck,
  Terminal,
  TrendingUp,
  X,
} from "lucide-react";

import { useMarketplaceStore } from "@/features/marketplace/model/marketplace-store";
import { CategoryDistributionMeter } from "@/features/marketplace/overview/charts/category-distribution-meter";
import { SourceCompositionDonut } from "@/features/marketplace/overview/charts/source-composition-donut";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";

interface DiscoveryTopic {
  label: string;
  query: string;
  category: string;
  icon: typeof Flame;
  iconBg: string;
}

const DISCOVERY_TOPICS: readonly DiscoveryTopic[] = [
  {
    category: "Modules & Kernel",
    icon: Flame,
    iconBg: "bg-chart-1/10 text-chart-1",
    label: "Root & Magisk",
    query: "root",
  },
  {
    category: "Shells & Coreutils",
    icon: Terminal,
    iconBg: "bg-chart-2/10 text-chart-2",
    label: "Terminal & CLI",
    query: "terminal",
  },
  {
    category: "VPN & Encryption",
    icon: ShieldCheck,
    iconBg: "bg-chart-3/10 text-chart-3",
    label: "Privacy & Security",
    query: "privacy",
  },
  {
    category: "Trackers & Resolvers",
    icon: Shield,
    iconBg: "bg-chart-4/10 text-chart-4",
    label: "Adblock & DNS",
    query: "dns",
  },
  {
    category: "Homescreen & Themes",
    icon: LayoutGrid,
    iconBg: "bg-chart-5/10 text-chart-5",
    label: "Launchers & UI",
    query: "launcher",
  },
  {
    category: "Bitwarden & 2FA",
    icon: KeyRound,
    iconBg: "bg-chart-1/10 text-chart-1",
    label: "Password Vaults",
    query: "password",
  },
  {
    category: "Equalizers & DACs",
    icon: Headphones,
    iconBg: "bg-chart-2/10 text-chart-2",
    label: "Audio & DSP",
    query: "audio",
  },
  {
    category: "Explorers & Cloud",
    icon: FolderArchive,
    iconBg: "bg-chart-3/10 text-chart-3",
    label: "Files & Storage",
    query: "file manager",
  },
];

interface MarketplaceOverviewTabProps {
  onQuickSearch: (query: string) => void;
}

export const MarketplaceOverviewTab = ({ onQuickSearch }: MarketplaceOverviewTabProps) => {
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const setActiveTab = useMarketplaceStore((state) => state.setActiveTab);
  const clearSearchHistory = useMarketplaceStore((state) => state.clearSearchHistory);

  const handleChipClick = (query: string) => {
    onQuickSearch(query);
    setActiveTab("browse");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Quick Search & Popular Queries Bar */}
      <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-3.5 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="border-primary/20 bg-primary/10 text-primary flex size-5.5 items-center justify-center rounded-xs border">
              <TrendingUp className="size-3.5" />
            </div>
            <span className="text-label text-foreground font-semibold tracking-wider uppercase">
              Instant Discovery & Popular Topics
            </span>
            <Badge className="text-caption px-1.5 py-0 font-mono" variant="neutral">
              8 topics
            </Badge>
          </div>
          <span className="text-caption text-muted-foreground hidden @sm:inline">
            Click topic to search catalog
          </span>
        </div>

        {/* 4x2 Symmetrical Hardware Cockpit Topic Grid */}
        <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
          {DISCOVERY_TOPICS.map((topic) => (
            <button
              className={cn(
                "group border-border/70 bg-surface-raised/30 hover:border-border hover:bg-surface-raised/80 flex items-center justify-between gap-2 rounded-md border p-2 text-left transition-all duration-150",
                "cursor-pointer hover:shadow-xs active:scale-[0.99]"
              )}
              key={topic.label}
              onClick={() => handleChipClick(topic.query)}
              type="button"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "border-border/50 flex size-7 shrink-0 items-center justify-center rounded-xs border transition-colors",
                    topic.iconBg
                  )}
                >
                  <topic.icon className="size-3.5" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="text-body text-foreground group-hover:text-primary truncate font-medium transition-colors">
                    {topic.label}
                  </span>
                  <span className="text-caption text-muted-foreground truncate">
                    {topic.category}
                  </span>
                </div>
              </div>
              <ArrowUpRight className="text-muted-foreground/40 group-hover:text-foreground mr-0.5 size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>

        {/* Recent Searches / Helper Bar */}
        <div className="border-border/50 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-muted-foreground flex items-center gap-1.5">
              <History className="size-3.5 shrink-0" />
              <span className="text-caption text-foreground font-medium">Recent searches:</span>
            </div>

            {(searchHistory ?? []).length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {(searchHistory ?? []).slice(0, 6).map((term) => (
                  <button
                    className="border-border/70 bg-surface-raised/40 text-caption text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground group flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 font-mono transition-colors"
                    key={term}
                    onClick={() => handleChipClick(term)}
                    type="button"
                  >
                    <Search className="text-muted-foreground/60 group-hover:text-foreground size-2.5 transition-colors" />
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-caption text-muted-foreground/60 italic">
                No recent queries yet — click any topic above to explore
              </span>
            )}
          </div>

          {(searchHistory ?? []).length > 0 && (
            <button
              className="text-caption text-muted-foreground/70 hover:text-foreground flex cursor-pointer items-center gap-1 transition-colors hover:underline"
              onClick={clearSearchHistory}
              type="button"
            >
              <X className="size-3" />
              <span>Clear history</span>
            </button>
          )}
        </div>
      </div>

      {/* Symmetrical Charts Duo Grid */}
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <SourceCompositionDonut />
        <CategoryDistributionMeter />
      </div>
    </div>
  );
};
