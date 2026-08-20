import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  MarketplaceGithubDevicePoll,
  MarketplaceGithubDeviceStart,
  MarketplaceGithubWebAuthFlow,
  MarketplaceLogout,
  MarketplaceSavePat,
} from '@/desktop/backend';
import { BrowserOpenURL } from '@/desktop/runtime';
import { useMarketplaceAuthStore } from '@/features/marketplace/model/authStore';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';

const AUTH_SCOPES = ['read:user'];
const SLOW_DOWN_MS = 5000;
// Komi public OAuth app — works for device + web PKCE, no user setup needed. User can override in Advanced.
const DEFAULT_CLIENT_ID = 'Ov23linTY28VFpFjFiI9';

export function useMarketplaceAuth() {
  const githubOauthClientId = useMarketplaceStore((state) => state.githubOauthClientId);
  const githubDeviceChallenge = useMarketplaceStore((state) => state.githubDeviceChallenge);
  const isGithubAuthenticating = useMarketplaceStore((state) => state.isGithubAuthenticating);
  const setGithubDeviceChallenge = useMarketplaceStore((state) => state.setGithubDeviceChallenge);
  const setGithubSession = useMarketplaceStore((state) => state.setGithubSession);
  const clearGithubSession = useMarketplaceStore((state) => state.clearGithubSession);
  const setIsGithubAuthenticating = useMarketplaceStore((state) => state.setIsGithubAuthenticating);
  const refreshSecureAuth = useMarketplaceAuthStore((state) => state.refresh);

  const timeoutRef = useRef<number | null>(null);

  const clearPendingPoll = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startGithubSignIn = useCallback(
    async (clientIdOverride?: string) => {
      const raw = (clientIdOverride ?? githubOauthClientId).trim();
      const resolvedClientId = raw || DEFAULT_CLIENT_ID;

      clearPendingPoll();
      setIsGithubAuthenticating(true);

      try {
        const challenge = await MarketplaceGithubDeviceStart(resolvedClientId, AUTH_SCOPES);
        setGithubDeviceChallenge({ challenge, clientId: resolvedClientId });
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

  const savePatSecure = useCallback(
    async (token: string) => {
      try {
        const status = await MarketplaceSavePat(token);
        // also mirror to old session for immediate UI
        setGithubSession({
          accessToken: token,
          user: status.login
            ? {
                login: status.login,
                avatarUrl: status.avatarUrl ?? null,
                profileUrl: status.profileUrl ?? null,
              }
            : null,
          rateLimit: null,
        });
        await refreshSecureAuth();
        toast.success('GitHub PAT saved to OS keychain');
        return true;
      } catch (error) {
        toast.error('Failed to save PAT', { description: String(error) });
        return false;
      }
    },
    [refreshSecureAuth, setGithubSession],
  );

  const webAuthSignIn = useCallback(
    async (clientIdOverride?: string) => {
      try {
        setIsGithubAuthenticating(true);
        const status = await MarketplaceGithubWebAuthFlow(clientIdOverride ?? null);
        setGithubSession({
          accessToken: '__keyring__',
          user: status.login
            ? {
                login: status.login,
                avatarUrl: status.avatarUrl ?? null,
                profileUrl: status.profileUrl ?? null,
              }
            : null,
          rateLimit: null,
        });
        await refreshSecureAuth();
        toast.success('Signed in via Web OAuth (keyring)');
        return true;
      } catch (error) {
        toast.error('Web OAuth failed', { description: String(error) });
        return false;
      } finally {
        setIsGithubAuthenticating(false);
      }
    },
    [refreshSecureAuth, setGithubSession, setIsGithubAuthenticating],
  );

  const signOutSecure = useCallback(async () => {
    try {
      await MarketplaceLogout();
    } catch {
      // ignore
    }
    clearGithubSession();
    await refreshSecureAuth();
    toast.success('Signed out — keychain cleared');
  }, [clearGithubSession, refreshSecureAuth]);

  useEffect(() => {
    if (!(githubDeviceChallenge && isGithubAuthenticating)) {
      return;
    }

    let cancelled = false;

    const schedulePoll = (delayMs: number) => {
      clearPendingPoll();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        void poll();
      }, delayMs);
    };

    const poll = async () => {
      try {
        const result = await MarketplaceGithubDevicePoll(
          githubDeviceChallenge.clientId,
          githubDeviceChallenge.challenge.deviceCode,
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
          // Persist to OS keychain securely (Komi KSafe parity)
          void MarketplaceSavePat(result.accessToken)
            .then(() => refreshSecureAuth())
            .catch(() => {});
          setGithubDeviceChallenge(null);
          setIsGithubAuthenticating(false);
          toast.success('Signed in with GitHub — token saved to OS keychain');
          return;
        }

        if (result.status === 'authorization_pending') {
          const nextIntervalMs =
            (result.interval ?? githubDeviceChallenge.challenge.interval) * 1000;
          schedulePoll(nextIntervalMs);
          return;
        }

        if (result.status === 'slow_down') {
          const nextIntervalMs =
            (result.interval ?? githubDeviceChallenge.challenge.interval) * 1000 + SLOW_DOWN_MS;
          schedulePoll(nextIntervalMs);
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

    schedulePoll(githubDeviceChallenge.challenge.interval * 1000);

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
    signOutGithub: signOutSecure,
    savePatSecure,
    webAuthSignIn,
  };
}
