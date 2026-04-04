import { useMarketplaceStore } from '@/lib/marketplaceStore';

export function AttributionFooter() {
  const { activeProviders } = useMarketplaceStore();

  const providerLinks: Record<string, string> = {
    'F-Droid': 'https://f-droid.org',
    GitHub: 'https://github.com',
    Aptoide: 'https://www.aptoide.com',
  };

  const active = activeProviders.filter((p) => providerLinks[p]);

  return (
    <div className="text-center text-[11px] text-muted-foreground/60 pt-2">
      Powered by{' '}
      {active.map((p, i) => (
        <span key={p}>
          {i > 0 && (i === active.length - 1 ? ' & ' : ', ')}
          <a
            href={providerLinks[p]}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            {p}
          </a>
        </span>
      ))}
    </div>
  );
}
