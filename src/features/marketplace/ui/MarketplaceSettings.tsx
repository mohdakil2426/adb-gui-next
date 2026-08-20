import { CheckCircle2, GitBranch, Loader2, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MarketplaceClearCache } from '@/desktop/backend';
import { BrowserOpenURL } from '@/desktop/runtime';
import { useMarketplaceAuth } from '@/features/marketplace/hooks/useMarketplaceAuth';
import { useMarketplaceAuthStore } from '@/features/marketplace/model/authStore';
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

function openExternal(url: string) {
  BrowserOpenURL(url);
}

async function handleClearCache() {
  try {
    await MarketplaceClearCache();
    toast.success('Marketplace cache cleared');
  } catch (error) {
    toast.error('Failed to clear marketplace cache', {
      description: String(error),
    });
  }
}

export function MarketplaceSettings() {
  const isSettingsOpen = useMarketplaceStore((state) => state.isSettingsOpen);
  const closeSettings = useMarketplaceStore((state) => state.closeSettings);
  const activeProviders = useMarketplaceStore((state) => state.activeProviders);
  const toggleProvider = useMarketplaceStore((state) => state.toggleProvider);
  const githubOauthClientId = useMarketplaceStore((state) => state.githubOauthClientId);
  const setGithubOauthClientId = useMarketplaceStore((state) => state.setGithubOauthClientId);
  const resultsPerProvider = useMarketplaceStore((state) => state.resultsPerProvider);
  const setResultsPerProvider = useMarketplaceStore((state) => state.setResultsPerProvider);
  const clearSearchHistory = useMarketplaceStore((state) => state.clearSearchHistory);
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const { tokenStatus, rateLimit } = useMarketplaceAuthStore();
  const {
    githubDeviceChallenge,
    isGithubAuthenticating,
    startGithubSignIn,
    cancelGithubSignIn,
    signOutGithub,
  } = useMarketplaceAuth();

  const [localClientId, setLocalClientId] = useState(githubOauthClientId);

  const isSignedIn = tokenStatus?.hasToken === true;
  const login = tokenStatus?.login ?? null;

  const handleSaveLocalSettings = () => {
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

  return (
    <Dialog onOpenChange={handleOpenChange} open={isSettingsOpen}>
      <DialogContent className="max-h-[85vh] max-w-140 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Marketplace settings
          </DialogTitle>
          <DialogDescription>
            Tune your providers, result density, cache behavior, and GitHub rate limits.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-1">
          <SourceSelectionSection
            activeProviders={activeProviders}
            toggleProvider={toggleProvider}
          />

          <Separator />

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 font-medium text-body">
              <GitBranch className="size-4 text-muted-foreground" />
              GitHub
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <FieldGroup className="gap-4">
                <div>
                  <p className="font-medium text-body">
                    {isSignedIn
                      ? `Signed in as ${login ?? 'github-user'}`
                      : 'Not signed in — one-click sign-in ready'}
                  </p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    {isSignedIn
                      ? `Keychain: ${tokenStatus?.source ?? 'keyring'} • Token is AES-256-GCM encrypted via OS keychain, never in localStorage.`
                      : 'Sign in once to get 5,000 GitHub API requests/hour (vs 60 anonymous). No setup needed — uses built-in OAuth app.'}
                  </p>
                  {isSignedIn && rateLimit ? (
                    <p className="mt-2 text-caption">
                      Rate limit: {rateLimit.remaining}/{rateLimit.limit} (reset in{' '}
                      {Math.ceil(rateLimit.secondsUntilReset / 60)} min)
                    </p>
                  ) : null}
                </div>

                {isSignedIn ? (
                  <div className="rounded-lg border bg-background/80 p-3 text-caption text-muted-foreground">
                    <div className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="size-4 text-success" />
                      <span className="font-medium">{login ?? 'Signed in'}</span>
                      {tokenStatus?.source ? (
                        <span className="text-caption text-muted-foreground">
                          via {tokenStatus.source}
                        </span>
                      ) : null}
                    </div>
                    {rateLimit ? (
                      <p className="mt-2">
                        Remaining API requests:{' '}
                        <span className="font-medium text-foreground">{rateLimit.remaining}</span> /{' '}
                        {rateLimit.limit}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {githubDeviceChallenge && isGithubAuthenticating ? (
                  <div className="rounded-lg border bg-background/80 p-3 text-caption text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Enter this code at github.com/login/device
                    </p>
                    <p className="mt-1 select-all font-mono text-foreground text-title tracking-[0.2em]">
                      {githubDeviceChallenge.challenge.userCode}
                    </p>
                    <p className="mt-1 text-caption">
                      Code expires in {Math.ceil(githubDeviceChallenge.challenge.expiresIn / 60)}{' '}
                      min — approve in browser to finish.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          openExternal(
                            githubDeviceChallenge.challenge.verificationUriComplete ??
                              githubDeviceChallenge.challenge.verificationUri,
                          );
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Open github.com/login/device
                      </Button>
                      <Button onClick={cancelGithubSignIn} size="sm" type="button" variant="ghost">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {isSignedIn ? (
                    <Button onClick={() => void signOutGithub()} type="button" variant="outline">
                      <LogOut aria-hidden="true" data-icon="inline-start" />
                      Sign out
                    </Button>
                  ) : (
                    <Button
                      disabled={isGithubAuthenticating}
                      onClick={() => void handleStartGithubSignIn()}
                      type="button"
                    >
                      {isGithubAuthenticating ? (
                        <Loader2
                          aria-hidden="true"
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                      ) : (
                        <GitBranch aria-hidden="true" data-icon="inline-start" />
                      )}
                      Sign in with GitHub
                    </Button>
                  )}
                </div>

                <Field>
                  <FieldLabel htmlFor="github-oauth-client-id">
                    GitHub OAuth client ID{' '}
                    <span className="text-muted-foreground">(advanced, optional)</span>
                  </FieldLabel>
                  <Input
                    autoComplete="off"
                    className="font-mono text-mono"
                    id="github-oauth-client-id"
                    name="github-oauth-client-id"
                    onChange={(event) => {
                      setLocalClientId(event.target.value);
                    }}
                    placeholder="Built-in Ov23linTY28VFpFjFiI9 used if empty"
                    spellCheck={false}
                    value={localClientId}
                  />
                  <p className="text-caption text-muted-foreground">
                    Leave empty for one-click sign-in. Custom ID only if you use your own GitHub
                    OAuth app.
                  </p>
                </Field>
              </FieldGroup>
            </div>
          </section>

          <Separator />

          <SearchPreferencesSection
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
