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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const setTrendingApps = useMarketplaceStore((state) => state.setTrendingApps);
  const setRecentReleaseApps = useMarketplaceStore((state) => state.setRecentReleaseApps);
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

        <div className="flex flex-col gap-6 py-1">
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-muted-foreground" />
              Source selection
            </div>
            <FieldGroup>
              {PROVIDERS.map((provider) => (
                <Field
                  key={provider.id}
                  orientation="horizontal"
                  data-disabled={
                    activeProviders.includes(provider.id) && activeProviders.length <= 1
                  }
                  className="justify-between rounded-lg border px-3 py-3"
                >
                  <FieldContent className="pr-4">
                    <FieldTitle>{provider.label}</FieldTitle>
                    <FieldDescription>{provider.description}</FieldDescription>
                  </FieldContent>
                  <Checkbox
                    aria-label={`Enable ${provider.label}`}
                    checked={activeProviders.includes(provider.id)}
                    onCheckedChange={() => toggleProvider(provider.id)}
                    disabled={activeProviders.includes(provider.id) && activeProviders.length <= 1}
                  />
                </Field>
              ))}
            </FieldGroup>
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GitBranch className="size-4 text-muted-foreground" />
              GitHub session
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <FieldGroup className="gap-4">
                <div>
                  <p className="text-sm font-medium">{authStatus}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Device-flow sign-in is optional and improves GitHub API rate limits without
                    affecting anonymous browsing.
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="github-oauth-client-id">GitHub OAuth client ID</FieldLabel>
                  <Input
                    id="github-oauth-client-id"
                    name="github-oauth-client-id"
                    autoComplete="off"
                    spellCheck={false}
                    value={localClientId}
                    onChange={(event) => setLocalClientId(event.target.value)}
                    placeholder="Iv1.xxxxxxxxxxxxxxxx"
                    className="font-mono text-xs"
                  />
                </Field>

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
                      {githubDeviceChallenge.challenge.userCode}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          BrowserOpenURL(
                            githubDeviceChallenge.challenge.verificationUriComplete ??
                              githubDeviceChallenge.challenge.verificationUri,
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
                        <Loader2 data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <GitBranch data-icon="inline-start" />
                      )}
                      Sign in with GitHub
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={signOutGithub}>
                      <LogOut data-icon="inline-start" />
                      Sign out
                    </Button>
                  )}
                </div>
              </FieldGroup>
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Search preferences
            </div>
            <FieldSet>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="results-per-provider">Results per provider</FieldLabel>
                  <Select
                    value={String(resultsPerProvider)}
                    onValueChange={(value) => setResultsPerProvider(Number(value))}
                  >
                    <SelectTrigger id="results-per-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {[6, 8, 12, 16].map((value) => (
                          <SelectItem key={value} value={String(value)}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="github-pat">Advanced fallback token</FieldLabel>
                  <Input
                    id="github-pat"
                    name="github-pat"
                    value={localPat}
                    onChange={(event) => setLocalPat(event.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="font-mono text-xs"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
            <FieldDescription>
              Personal access tokens are optional session-only fallbacks. They are kept in memory
              for the current app session and are not saved after reload or restart.
            </FieldDescription>
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCw className="size-4 text-muted-foreground" />
              Cache and history
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleClearCache}>
                <RefreshCw data-icon="inline-start" />
                Clear cache
              </Button>
              <Button
                variant="outline"
                onClick={clearSearchHistory}
                disabled={searchHistory.length === 0}
              >
                <Trash2 data-icon="inline-start" />
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
