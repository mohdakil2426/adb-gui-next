import { BrowserOpenURL } from '@/desktop/runtime';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';

export function AttributionFooter() {
  const activeProviders = useMarketplaceStore((state) => state.activeProviders);

  const providerLinks: Record<string, string> = {
    'F-Droid': 'https://f-droid.org',
    GitHub: 'https://github.com',
    Aptoide: 'https://www.aptoide.com',
  };

  const active = activeProviders.filter((p) => providerLinks[p]);

  return (
    <div className="pt-2 text-center text-[11px] text-muted-foreground/60">
      Powered by{' '}
      {active.map((p, i) => (
        <span key={p}>
          {i > 0 && (i === active.length - 1 ? ' & ' : ', ')}
          <button
            className="cursor-pointer border-none bg-transparent p-0 transition-colors hover:text-muted-foreground hover:underline"
            onClick={() => {
              const link = providerLinks[p];
              if (link) {
                BrowserOpenURL(link);
              }
            }}
            type="button"
          >
            {p}
          </button>
        </span>
      ))}
    </div>
  );
}
