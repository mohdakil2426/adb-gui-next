import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  GitBranch,
  Loader2,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Separator } from '@/components/ui/separator';
import { MarketplaceClearCache } from '@/lib/desktop/backend';
import { BrowserOpenURL } from '@/lib/desktop/runtime';
import { useMarketplaceAuth } from '@/lib/marketplace/useMarketplaceAuth';
import { useMarketplaceStore } from '@/lib/marketplaceStore';
import type { backend } from '@/lib/desktop/models';

type ProviderSource = backend.ProviderSource;

const PROVIDERS: { id: ProviderSource; label: string; description: string }[] = [
  { id: 'F-Droid', label: 'F-Droid', description: 'Free and open-source Android apps' },
  {
    id: 'IzzyOnDroid',
    label: 'IzzyOnDroid',
    description: 'F-Droid-compatible repo with more niche Android packages',
  },
  {
    id: 'GitHub',
    label: 'GitHub Releases',
    description: 'Open-source repositories with release assets',
  },
  {
    id: 'Aptoide',
    label: 'Aptoide',
    description: 'Consumer app store with trusted-package filtering',
  },
];

export function MarketplaceSettings() {
  const {
    isSettingsOpen,
    closeSettings,
    activeProviders,
    toggleProvider,
    githubPat,
    setGithubPat,
    githubOauthClientId,
    setGithubOauthClientId,
    resultsPerProvider,
    setResultsPerProvider,
    clearSearchHistory,
    searchHistory,
    githubSession,
    setTrendingApps,
    setRecentReleaseApps,
  } = useMarketplaceStore();
  const {
    githubDeviceChallenge,
    isGithubAuthenticating,
    startGithubSignIn,
    cancelGithubSignIn,
    signOutGithub,
  } = useMarketplaceAuth();

  const [localPat, setLocalPat] = useState(githubPat);
  const [localClientId, setLocalClientId] = useState(githubOauthClientId);

  const authStatus = useMemo(() => {
    if (githubSession.user) {
      return `Signed in as ${githubSession.user.login}`;
    }

    if (localClientId.trim()) {
      return 'Ready for GitHub device-flow sign-in';
    }

    return 'GitHub sign-in is unavailable until an OAuth client ID is configured';
  }, [githubSession.user, localClientId]);

  const handleSaveLocalSettings = () => {
    setGithubPat(localPat.trim());
    setGithubOauthClientId(localClientId.trim());
  };

  const handleStartGithubSignIn = async () => {
    handleSaveLocalSettings();
    await startGithubSignIn(localClientId.trim());
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleSaveLocalSettings();
      closeSettings();
    }
  };

  const handleClearCache = async () => {
    try {
      await MarketplaceClearCache();
      setTrendingApps([]);
      setRecentReleaseApps([]);
      toast.success('Marketplace cache cleared');
    } catch (error) {
      toast.error('Failed to clear marketplace cache', {
        description: String(error),
      });
    }
  };

  return (
    <Dialog open={isSettingsOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-140">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Marketplace settings
          </DialogTitle>
          <DialogDescription>
            Tune your providers, result density, cache behavior, and optional GitHub session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-muted-foreground" />
              Source selection
            </div>
            <div className="space-y-2">
              {PROVIDERS.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-3"
                >
                  <div className="space-y-1 pr-4">
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
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GitBranch className="size-4 text-muted-foreground" />
              GitHub session
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{authStatus}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Device-flow sign-in is optional and improves GitHub API rate limits without
                    affecting anonymous browsing.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github-oauth-client-id">GitHub OAuth client ID</Label>
                  <Input
                    id="github-oauth-client-id"
                    value={localClientId}
                    onChange={(event) => setLocalClientId(event.target.value)}
                    placeholder="Iv1.xxxxxxxxxxxxxxxx"
                    className="font-mono text-xs"
                  />
                </div>

                {githubSession.user && (
                  <div className="rounded-lg border bg-background/80 p-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="size-4" />
                      <span className="font-medium">{githubSession.user.login}</span>
                    </div>
                    {githubSession.rateLimit && (
                      <p className="mt-2">
                        Remaining API requests:{' '}
                        <span className="font-medium text-foreground">
                          {githubSession.rateLimit.remaining}
                        </span>{' '}
                        / {githubSession.rateLimit.limit}
                      </p>
                    )}
                  </div>
                )}

                {githubDeviceChallenge && isGithubAuthenticating && (
                  <div className="rounded-lg border bg-background/80 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Verification code</p>
                    <p className="mt-1 font-mono text-sm tracking-[0.2em] text-foreground">
                      {githubDeviceChallenge.userCode}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          BrowserOpenURL(
                            githubDeviceChallenge.verificationUriComplete ??
                              githubDeviceChallenge.verificationUri,
                          )
                        }
                      >
                        Open verification page
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelGithubSignIn}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {!githubSession.user ? (
                    <Button
                      onClick={() => void handleStartGithubSignIn()}
                      disabled={!localClientId.trim() || isGithubAuthenticating}
                    >
                      {isGithubAuthenticating ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <GitBranch className="mr-2 size-4" />
                      )}
                      Sign in with GitHub
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={signOutGithub}>
                      <LogOut className="mr-2 size-4" />
                      Sign out
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Search preferences
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="results-per-provider">Results per provider</Label>
                <select
                  id="results-per-provider"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={resultsPerProvider}
                  onChange={(event) => setResultsPerProvider(Number(event.target.value))}
                >
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={16}>16</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="github-pat">Advanced fallback token</Label>
                <Input
                  id="github-pat"
                  value={localPat}
                  onChange={(event) => setLocalPat(event.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="font-mono text-xs"
                  type="password"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Personal access tokens remain optional for power users, but the preferred UX is GitHub
              sign-in above.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCw className="size-4 text-muted-foreground" />
              Cache and history
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleClearCache}>
                <RefreshCw className="mr-2 size-4" />
                Clear cache
              </Button>
              <Button
                variant="outline"
                onClick={clearSearchHistory}
                disabled={searchHistory.length === 0}
              >
                <Trash2 className="mr-2 size-4" />
                Clear search history
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {searchHistory.length > 0
                ? `${searchHistory.length} recent search${searchHistory.length !== 1 ? 'es' : ''} saved locally.`
                : 'No local search history saved yet.'}
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
