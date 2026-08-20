import { Package } from 'lucide-react';
import { useState } from 'react';

interface MarketplaceAppIconProps {
  alt?: string;
  iconUrl?: string | null | undefined;
  size?: 'sm' | 'lg';
}

const SIZE_CONFIG = {
  sm: {
    container: 'size-10',
    fallback: 'size-5',
    img: 'size-10',
    px: 40,
  },
  lg: {
    container: 'size-18',
    fallback: 'size-8',
    img: 'size-18',
    px: 72,
  },
} as const;

export function MarketplaceAppIcon({ alt = '', iconUrl, size = 'sm' }: MarketplaceAppIconProps) {
  const [failed, setFailed] = useState(false);
  const config = SIZE_CONFIG[size];
  const showFallback = !iconUrl || failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised ${config.container}`}
    >
      {showFallback ? (
        <Package className={`${config.fallback} text-muted-foreground`} />
      ) : (
        <img
          alt={alt}
          className={`${config.img} object-cover`}
          height={config.px}
          loading="lazy"
          onError={() => setFailed(true)}
          src={iconUrl}
          width={config.px}
        />
      )}
    </div>
  );
}
