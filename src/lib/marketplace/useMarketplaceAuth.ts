import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { MarketplaceGithubDevicePoll, MarketplaceGithubDeviceStart } from '@/lib/desktop/backend';
import { BrowserOpenURL } from '@/lib/desktop/runtime';
import { useMarketplaceStore } from '@/lib/marketplaceStore';

const AUTH_SCOPES = ['read:user'];
const SLOW_DOWN_MS = 5000;

export function useMarketplaceAuth() {
  const {
    githubOauthClientId,
    githubDeviceChallenge,
    isGithubAuthenticating,
    setGithubDeviceChallenge,
    setGithubSession,
    clearGithubSession,
    setIsGithubAuthenticating,
  } = useMarketplaceStore();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingPoll = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startGithubSignIn = useCallback(
    async (clientIdOverride?: string) => {
      const resolvedClientId = (clientIdOverride ?? githubOauthClientId).trim();

      if (!resolvedClientId) {
        toast.error('GitHub OAuth client ID is required before sign-in');
        return;
      }

      clearPendingPoll();
      setIsGithubAuthenticating(true);

      try {
        const challenge = await MarketplaceGithubDeviceStart(resolvedClientId, AUTH_SCOPES);
        setGithubDeviceChallenge(challenge);
        BrowserOpenURL(challenge.verificationUriComplete ?? challenge.verificationUri);
        toast.success('GitHub verification started', {
          description: `Enter code ${challenge.userCode} in your browser if the page did not open automatically.`,
        });
      } catch (error) {
        setIsGithubAuthenticating(false);
        setGithubDeviceChallenge(null);
        toast.error('GitHub sign-in failed to start', {
          description: String(error),
        });
      }
    },
    [clearPendingPoll, githubOauthClientId, setGithubDeviceChallenge, setIsGithubAuthenticating],
  );

  const cancelGithubSignIn = useCallback(() => {
    clearPendingPoll();
    setGithubDeviceChallenge(null);
    setIsGithubAuthenticating(false);
  }, [clearPendingPoll, setGithubDeviceChallenge, setIsGithubAuthenticating]);

  useEffect(() => {
    if (!githubDeviceChallenge || !isGithubAuthenticating) {
      return;
    }

    let cancelled = false;

    const poll = async (intervalMs: number) => {
      try {
        const result = await MarketplaceGithubDevicePoll(
          githubOauthClientId.trim(),
          githubDeviceChallenge.deviceCode,
        );

        if (cancelled) {
          return;
        }

        if (result.status === 'authorized' && result.accessToken) {
          setGithubSession({
            accessToken: result.accessToken,
            user: result.user,
            rateLimit: result.rateLimit,
          });
          setGithubDeviceChallenge(null);
          setIsGithubAuthenticating(false);
          toast.success('Signed in with GitHub');
          return;
        }

        if (result.status === 'authorization_pending') {
          timeoutRef.current = setTimeout(() => {
            void poll((result.interval ?? githubDeviceChallenge.interval) * 1000);
          }, intervalMs);
          return;
        }

        if (result.status === 'slow_down') {
          timeoutRef.current = setTimeout(() => {
            void poll((result.interval ?? githubDeviceChallenge.interval) * 1000 + SLOW_DOWN_MS);
          }, intervalMs + SLOW_DOWN_MS);
          return;
        }

        if (result.status === 'access_denied' || result.status === 'expired_token') {
          setGithubDeviceChallenge(null);
          setIsGithubAuthenticating(false);
          toast.error(
            result.status === 'access_denied'
              ? 'GitHub sign-in was cancelled'
              : 'GitHub code expired',
            {
              description: result.message ?? undefined,
            },
          );
          return;
        }

        setGithubDeviceChallenge(null);
        setIsGithubAuthenticating(false);
        toast.error('GitHub sign-in failed', {
          description: result.message ?? result.status,
        });
      } catch (error) {
        if (!cancelled) {
          setGithubDeviceChallenge(null);
          setIsGithubAuthenticating(false);
          toast.error('GitHub sign-in polling failed', {
            description: String(error),
          });
        }
      }
    };

    timeoutRef.current = setTimeout(() => {
      void poll(githubDeviceChallenge.interval * 1000);
    }, githubDeviceChallenge.interval * 1000);

    return () => {
      cancelled = true;
      clearPendingPoll();
    };
  }, [
    clearPendingPoll,
    githubDeviceChallenge,
    githubOauthClientId,
    isGithubAuthenticating,
    setGithubDeviceChallenge,
    setGithubSession,
    setIsGithubAuthenticating,
  ]);

  return {
    githubDeviceChallenge,
    isGithubAuthenticating,
    startGithubSignIn,
    cancelGithubSignIn,
    signOutGithub: clearGithubSession,
  };
}
