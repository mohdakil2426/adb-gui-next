import { useState } from 'react';
import { Settings, Eye, EyeOff, KeyRound, ToggleLeft, SlidersHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useMarketplaceStore } from '@/lib/marketplaceStore';
import type { backend } from '@/lib/desktop/models';

type ProviderSource = backend.ProviderSource;

const PROVIDERS: { id: ProviderSource; label: string; description: string }[] = [
  { id: 'F-Droid', label: 'F-Droid', description: 'Free and open-source Android apps' },
  {
    id: 'IzzyOnDroid',
    label: 'IzzyOnDroid',
    description: 'Extended F-Droid repository (cross-references F-Droid results)',
  },
  { id: 'GitHub', label: 'GitHub Releases', description: 'Open-source apps with APK releases' },
  { id: 'Aptoide', label: 'Aptoide', description: 'Independent Android app store' },
];

export function MarketplaceSettings() {
  const {
    isSettingsOpen,
    closeSettings,
    activeProviders,
    toggleProvider,
    githubPat,
    setGithubPat,
    resultsPerProvider,
    setResultsPerProvider,
    clearSearchHistory,
    searchHistory,
  } = useMarketplaceStore();

  const [showPat, setShowPat] = useState(false);
  const [localPat, setLocalPat] = useState(githubPat);

  const handleSavePat = () => {
    setGithubPat(localPat.trim());
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Save PAT on close if changed
      if (localPat.trim() !== githubPat) {
        setGithubPat(localPat.trim());
      }
      closeSettings();
    }
  };

  return (
    <Dialog open={isSettingsOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Marketplace Settings
          </DialogTitle>
          <DialogDescription>
            Configure search providers, GitHub authentication, and preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ─── Providers Section ──────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
              Providers
            </div>
            <div className="space-y-2">
              {PROVIDERS.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{provider.label}</Label>
                    <p className="text-xs text-muted-foreground">{provider.description}</p>
                  </div>
                  <Checkbox
                    checked={activeProviders.includes(provider.id)}
                    onCheckedChange={() => toggleProvider(provider.id)}
                    disabled={activeProviders.includes(provider.id) && activeProviders.length <= 1}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ─── GitHub Token Section ──────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              GitHub Access Token
            </div>
            <p className="text-xs text-muted-foreground">
              A Personal Access Token increases GitHub API rate limits from 10 to 30
              requests/minute. No special scopes needed — a classic token with no permissions works.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPat ? 'text' : 'password'}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={localPat}
                  onChange={(e) => setLocalPat(e.target.value)}
                  className="pr-10 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                  onClick={() => setShowPat(!showPat)}
                >
                  {showPat ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSavePat}
                disabled={localPat.trim() === githubPat}
              >
                Save
              </Button>
            </div>
            {githubPat && (
              <p className="text-xs text-emerald-500 dark:text-emerald-400">
                ✓ Token configured — enhanced rate limits active
              </p>
            )}
          </div>

          {/* ─── Preferences Section ──────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              Preferences
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Results per provider</Label>
              <select
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={resultsPerProvider}
                onChange={(e) => setResultsPerProvider(Number(e.target.value))}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
              </select>
            </div>

            {searchHistory.length > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Search history</Label>
                  <p className="text-xs text-muted-foreground">
                    {searchHistory.length} saved searches
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearSearchHistory}
                  className="text-destructive hover:text-destructive"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
