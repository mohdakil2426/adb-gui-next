import { GitBranch, Key, LogOut, ShieldAlert, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMarketplaceAuth } from '@/features/marketplace/hooks/useMarketplaceAuth';
import {
  getMarketplaceEffectiveGithubToken,
  useMarketplaceStore,
} from '@/features/marketplace/model/marketplaceStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';

export function GithubAuthCard() {
  const githubPat = useMarketplaceStore((state) => state.githubPat);
  const setGithubPat = useMarketplaceStore((state) => state.setGithubPat);
  const githubSession = useMarketplaceStore((state) => state.githubSession);

  const { signOutGithub } = useMarketplaceAuth();

  const [localPat, setLocalPat] = useState(githubPat);

  const handleSavePat = () => {
    setGithubPat(localPat.trim());
    toast.success('GitHub Personal Access Token updated for current session');
  };

  const rateLimit = githubSession.rateLimit;
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
          limits when browsing releases.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Active Session Info if signed in */}
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
              <LogOut className="size-3.5" />
              Sign Out
            </Button>
          </div>
        ) : null}

        {/* PAT Input Field */}
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
        </div>

        {/* Rate Limit Readout */}
        {rateLimit ? (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-raised/20 px-3.5 py-2 text-caption text-muted-foreground">
            <span>
              Remaining quota: <strong className="text-foreground">{rateLimit.remaining}</strong> of{' '}
              {rateLimit.limit}
            </span>
            {rateLimit.resetAt ? (
              <span>
                Resets at:{' '}
                <strong className="text-foreground">
                  {new Date(rateLimit.resetAt).toLocaleTimeString()}
                </strong>
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
