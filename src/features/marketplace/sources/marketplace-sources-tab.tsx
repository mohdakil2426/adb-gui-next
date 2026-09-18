import { CachePreferencesCard } from "@/features/marketplace/sources/cache-preferences-card";
import { GithubAuthCard } from "@/features/marketplace/sources/github-auth-card";
import { RepositorySourcesCard } from "@/features/marketplace/sources/repository-sources-card";

export const MarketplaceSourcesTab = () => (
  <div className="flex flex-col gap-6">
    <RepositorySourcesCard />
    <GithubAuthCard />
    <CachePreferencesCard />
  </div>
);
