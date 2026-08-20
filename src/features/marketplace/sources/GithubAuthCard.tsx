import {
  CheckCircle2,
  GitBranch,
  Key,
  Loader2,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BrowserOpenURL } from '@/desktop/runtime';
import { useMarketplaceAuth } from '@/features/marketplace/hooks/useMarketplaceAuth';
import { useMarketplaceAuthStore } from '@/features/marketplace/model/authStore';
import {
  getMarketplaceEffectiveGithubToken,
  useMarketplaceStore,
} from '@/features/marketplace/model/marketplaceStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

function openExternal(url: string) {
  BrowserOpenURL(url);
}

export function GithubAuthCard() {
  const githubPat = useMarketplaceStore((state) => state.githubPat);
  const setGithubPat = useMarketplaceStore((state) => state.setGithubPat);
  const githubSession = useMarketplaceStore((state) => state.githubSession);
  const githubOauthClientId = useMarketplaceStore((state) => state.githubOauthClientId);
  const setGithubOauthClientId = useMarketplaceStore((state) => state.setGithubOauthClientId);
  const { tokenStatus, rateLimit: authRateLimit } = useMarketplaceAuthStore();
  const {
    githubDeviceChallenge,
    isGithubAuthenticating,
    startGithubSignIn,
    cancelGithubSignIn,
    signOutGithub,
  } = useMarketplaceAuth();

  const [localPat, setLocalPat] = useState(githubPat);
  const [localClientId, setLocalClientId] = useState(githubOauthClientId);

  const handleSavePat = () => {
    setGithubPat(localPat.trim());
    toast.success('GitHub Personal Access Token updated for current session');
  };

  const handleStartGithubSignIn = async () => {
    setGithubOauthClientId(localClientId.trim());
    await startGithubSignIn(localClientId.trim());
  };

  const isSignedIn = tokenStatus?.hasToken === true;
  const login = tokenStatus?.login ?? githubSession.user?.login ?? null;
  const rateLimit = authRateLimit ?? githubSession.rateLimit;
  const effectiveToken = useMarketplaceStore(getMarketplaceEffectiveGithubToken);

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground text-title">
            <GitBranch className="size-5 text-muted-foreground" />
            GitHub API Rate Limit & Authentication
          </CardTitle>
          {effectiveToken ? (
            <Badge className="gap-1 text-[10px]" variant="success">
              <ShieldCheck className="size-3" />
              Authenticated (5,000 req/hr)
            </Badge>
          ) : (
            <Badge className="gap-1 text-[10px]" variant="outline">
              <ShieldAlert className="size-3 text-warning" />
              Anonymous (60 req/hr)
            </Badge>
          )}
        </div>
        <CardDescription className="text-caption">
          Provide a GitHub Personal Access Token or sign in via OAuth Device Flow to bypass rate
          limits when browsing releases. Token is AES-256-GCM encrypted via OS keychain, never in
          localStorage.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Keychain / Sign-in status — moved from Settings dialog */}
        <div className="rounded-lg border bg-muted/20 p-4">
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
          {isSignedIn && authRateLimit ? (
            <p className="mt-2 text-caption">
              Rate limit: {authRateLimit.remaining}/{authRateLimit.limit} (reset in{' '}
              {Math.ceil(authRateLimit.secondsUntilReset / 60)} min)
            </p>
          ) : null}

          {isSignedIn ? (
            <div className="mt-3 rounded-lg border bg-background/80 p-3 text-caption text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="size-4 text-success" />
                <span className="font-medium">{login ?? 'Signed in'}</span>
                {tokenStatus?.source ? (
                  <span className="text-caption text-muted-foreground">
                    via {tokenStatus.source}
                  </span>
                ) : null}
              </div>
              {authRateLimit ? (
                <p className="mt-2">
                  Remaining API requests:{' '}
                  <span className="font-medium text-foreground">{authRateLimit.remaining}</span> /{' '}
                  {authRateLimit.limit}
                </p>
              ) : null}
            </div>
          ) : null}

          {githubDeviceChallenge && isGithubAuthenticating ? (
            <div className="mt-3 rounded-lg border bg-background/80 p-3 text-caption text-muted-foreground">
              <p className="font-medium text-foreground">
                Enter this code at github.com/login/device
              </p>
              <p className="mt-1 select-all font-mono text-foreground text-title tracking-[0.2em]">
                {githubDeviceChallenge.challenge.userCode}
              </p>
              <p className="mt-1 text-caption">
                Code expires in {Math.ceil(githubDeviceChallenge.challenge.expiresIn / 60)} min —
                approve in browser to finish.
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

          <div className="mt-3 flex flex-wrap gap-2">
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
                  <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
                ) : (
                  <GitBranch aria-hidden="true" data-icon="inline-start" />
                )}
                Sign in with GitHub
              </Button>
            )}
          </div>

          <Field className="mt-4">
            <FieldLabel htmlFor="github-oauth-client-id">
              GitHub OAuth client ID{' '}
              <span className="text-muted-foreground">(advanced, optional)</span>
            </FieldLabel>
            <Input
              autoComplete="off"
              className="font-mono text-mono"
              id="github-oauth-client-id"
              name="github-oauth-client-id"
              onBlur={() => setGithubOauthClientId(localClientId.trim())}
              onChange={(event) => {
                setLocalClientId(event.target.value);
              }}
              placeholder="Built-in Ov23linTY28VFpFjFiI9 used if empty"
              spellCheck={false}
              value={localClientId}
            />
            <p className="text-caption text-muted-foreground">
              Leave empty for one-click sign-in. Custom ID only if you use your own GitHub OAuth
              app.
            </p>
          </Field>
        </div>

        {/* Active Session Info if signed in — legacy PAT session */}
        {githubSession.user ? (
          <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-raised">
                <User className="size-4.5 text-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-body text-foreground">
                  @{githubSession.user.login}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  GitHub Account Active
                </span>
              </div>
            </div>

            <Button
              className="h-8 gap-1.5 text-caption"
              onClick={signOutGithub}
              size="sm"
              type="button"
              variant="outline"
            >
              <LogOut aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              Sign Out
            </Button>
          </div>
        ) : null}

        {/* PAT Input Field — moved from Settings */}
        <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
          <div className="flex items-center justify-between">
            <label
              className="flex items-center gap-1.5 font-medium text-body text-foreground"
              htmlFor="github-pat-input"
            >
              <Key className="size-4 text-muted-foreground" />
              Session Personal Access Token (PAT)
            </label>
            <span className="text-[10px] text-muted-foreground">In-memory only</span>
          </div>

          <div className="flex gap-2">
            <Input
              autoComplete="current-password"
              className="font-mono text-mono-sm"
              id="github-pat-input"
              onChange={(e) => setLocalPat(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              type="password"
              value={localPat}
            />
            <Button
              className="shrink-0"
              disabled={localPat === githubPat}
              onClick={handleSavePat}
              type="button"
            >
              Save Token
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">
            PAT is session-only, alternative to OAuth device flow above. Either method unlocks 5,000
            req/hr.
          </p>
        </div>

        {/* Rate Limit Readout */}
        {rateLimit ? (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-raised/20 px-3.5 py-2 text-caption text-muted-foreground">
            <span>
              Remaining quota: <strong className="text-foreground">{rateLimit.remaining}</strong> of{' '}
              {rateLimit.limit}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
