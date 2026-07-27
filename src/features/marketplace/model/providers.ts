import type { backend } from '@/desktop/models';

type ProviderSource = backend.ProviderSource;

/**
 * The marketplace providers, declared once.
 *
 * The sidebar header used to advertise a hardcoded "4 providers" while the
 * filter bar listed three — a number nobody could verify because it was written
 * as a string. Everything that names or counts providers reads this list.
 */
export const MARKETPLACE_PROVIDERS: readonly { id: ProviderSource; label: string }[] = [
  { id: 'F-Droid', label: 'F-Droid' },
  { id: 'GitHub', label: 'GitHub' },
  { id: 'Aptoide', label: 'Aptoide' },
] as const;

export const ALL_PROVIDER_IDS: ProviderSource[] = MARKETPLACE_PROVIDERS.map(
  (provider) => provider.id,
);
