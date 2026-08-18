import { CachePreferencesCard } from '@/features/marketplace/sources/CachePreferencesCard';
import { GithubAuthCard } from '@/features/marketplace/sources/GithubAuthCard';
import { RepositorySourcesCard } from '@/features/marketplace/sources/RepositorySourcesCard';

export function MarketplaceSourcesTab() {
  return (
    <div className="flex flex-col gap-6">
      <RepositorySourcesCard />
      <GithubAuthCard />
      <CachePreferencesCard />
    </div>
  );
}
