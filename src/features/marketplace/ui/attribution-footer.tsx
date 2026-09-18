import { BrowserOpenURL } from "@/desktop/runtime";
import { useMarketplaceStore } from "@/features/marketplace/model/marketplace-store";

const PROVIDER_LINKS = {
  Aptoide: "https://www.aptoide.com",
  "F-Droid": "https://f-droid.org",
  GitHub: "https://github.com",
} as const;

const openExternal = (url: string) => {
  BrowserOpenURL(url);
};

export const AttributionFooter = () => {
  const activeProviders = useMarketplaceStore((state) => state.activeProviders);

  const active = activeProviders.filter((p) => p in PROVIDER_LINKS);

  return (
    <div className="pt-2 text-center text-caption text-muted-foreground">
      Powered by{" "}
      {active.map((p, i) => (
        <span key={p}>
          {i > 0 && (i === active.length - 1 ? " & " : ", ")}
          <button
            className="cursor-pointer border-none bg-transparent p-0 underline-offset-2 transition-colors duration-90 ease-standard hover:text-foreground hover:underline"
            onClick={() => {
              const link = PROVIDER_LINKS[p as keyof typeof PROVIDER_LINKS];
              if (link) {
                openExternal(link);
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
};
