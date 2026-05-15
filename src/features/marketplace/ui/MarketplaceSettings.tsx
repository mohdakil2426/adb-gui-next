import { CheckCircle2, GitBranch, Loader2, LogOut, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MarketplaceClearCache } from '@/desktop/backend';
import { BrowserOpenURL } from '@/desktop/runtime';
import { useMarketplaceAuth } from '@/features/marketplace/hooks/useMarketplaceAuth';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { CacheHistorySection } from '@/features/marketplace/ui/settings/CacheHistorySection';
import { SearchPreferencesSection } from '@/features/marketplace/ui/settings/SearchPreferencesSection';
import { SourceSelectionSection } from '@/features/marketplace/ui/settings/SourceSelectionSection';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Separator } from '@/shared/ui/separator';

export function MarketplaceSettings() {
  const isSettingsOpen = useMarketplaceStore((state) => state.isSettingsOpen);
  const closeSettings = useMarketplaceStore((state) => state.closeSettings);
  const activeProviders = useMarketplaceStore((state) => state.activeProviders);
  const toggleProvider = useMarketplaceStore((state) => state.toggleProvider);
  const githubPat = useMarketplaceStore((state) => state.githubPat);
  const setGithubPat = useMarketplaceStore((state) => state.setGithubPat);
  const githubOauthClientId = useMarketplaceStore((state) => state.githubOauthClientId);
  const setGithubOauthClientId = useMarketplaceStore((state) => state.setGithubOauthClientId);
  const resultsPerProvider = useMarketplaceStore((state) => state.resultsPerProvider);
  const setResultsPerProvider = useMarketplaceStore((state) => state.setResultsPerProvider);
  const clearSearchHistory = useMarketplaceStore((state) => state.clearSearchHistory);
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const githubSession = useMarketplaceStore((state) => state.githubSession);
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
      toast.success('Marketplace cache cleared');
    } catch (error) {
      toast.error('Failed to clear marketplace cache', {
        description: String(error),
      });
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={isSettingsOpen}>
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

        <div className="flex flex-col gap-6 py-1">
          <SourceSelectionSection
            activeProviders={activeProviders}
            toggleProvider={toggleProvider}
          />

          <Separator />

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 font-medium text-sm">
              <GitBranch className="size-4 text-muted-foreground" />
              GitHub session
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <FieldGroup className="gap-4">
                <div>
                  <p className="font-medium text-sm">{authStatus}</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Device-flow sign-in is optional and improves GitHub API rate limits without
                    affecting anonymous browsing.
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="github-oauth-client-id">GitHub OAuth client ID</FieldLabel>
                  <Input
                    autoComplete="off"
                    className="font-mono text-xs"
                    id="github-oauth-client-id"
                    name="github-oauth-client-id"
                    onChange={(event) => {
                      setLocalClientId(event.target.value);
                    }}
                    placeholder="Iv1.xxxxxxxxxxxxxxxx"
                    spellCheck={false}
                    value={localClientId}
                  />
                </Field>

                {githubSession.user ? (
                  <div className="rounded-lg border bg-background/80 p-3 text-muted-foreground text-xs">
                    <div className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="size-4" />
                      <span className="font-medium">{githubSession.user.login}</span>
                    </div>
                    {githubSession.rateLimit ? (
                      <p className="mt-2">
                        Remaining API requests:{' '}
                        <span className="font-medium text-foreground">
                          {githubSession.rateLimit.remaining}
                        </span>{' '}
                        / {githubSession.rateLimit.limit}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {githubDeviceChallenge && isGithubAuthenticating ? (
                  <div className="rounded-lg border bg-background/80 p-3 text-muted-foreground text-xs">
                    <p className="font-medium text-foreground">Verification code</p>
                    <p className="mt-1 font-mono text-foreground text-sm tracking-[0.2em]">
                      {githubDeviceChallenge.challenge.userCode}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          BrowserOpenURL(
                            githubDeviceChallenge.challenge.verificationUriComplete ??
                              githubDeviceChallenge.challenge.verificationUri,
                          );
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Open verification page
                      </Button>
                      <Button onClick={cancelGithubSignIn} size="sm" variant="ghost">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {githubSession.user ? (
                    <Button onClick={signOutGithub} variant="outline">
                      <LogOut data-icon="inline-start" />
                      Sign out
                    </Button>
                  ) : (
                    <Button
                      disabled={!localClientId.trim() || isGithubAuthenticating}
                      onClick={() => void handleStartGithubSignIn()}
                    >
                      {isGithubAuthenticating ? (
                        <Loader2 className="animate-spin" data-icon="inline-start" />
                      ) : (
                        <GitBranch data-icon="inline-start" />
                      )}
                      Sign in with GitHub
                    </Button>
                  )}
                </div>
              </FieldGroup>
            </div>
          </section>

          <Separator />

          <SearchPreferencesSection
            localPat={localPat}
            onLocalPatChange={setLocalPat}
            onResultsPerProviderChange={setResultsPerProvider}
            resultsPerProvider={resultsPerProvider}
          />

          <Separator />

          <CacheHistorySection
            onClearCache={() => {
              void handleClearCache();
            }}
            onClearSearchHistory={clearSearchHistory}
            searchHistoryCount={searchHistory.length}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
