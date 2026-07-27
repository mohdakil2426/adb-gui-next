import { ImageOff } from 'lucide-react';
import { useState } from 'react';

/** Portrait phone shot — fixes the slot size so loading cannot shift the page. */
const SHOT_WIDTH = 405;
const SHOT_HEIGHT = 720;

interface AppScreenshotsProps {
  appName: string;
  urls: string[];
}

/**
 * Remote screenshots, honestly handled.
 *
 * These were bare `<img alt="">` tags with no error path: a dead URL left a
 * blank rectangle and no explanation, and the unsized images reflowed the page
 * as each one arrived.
 */
export function AppScreenshots({ appName, urls }: AppScreenshotsProps) {
  const [brokenUrls, setBrokenUrls] = useState<ReadonlySet<string>>(() => new Set());

  const usable = urls.filter((url) => !brokenUrls.has(url));

  if (usable.length === 0) {
    return (
      <p className="flex items-center gap-2 text-body text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-4 shrink-0" />
        {urls.length === 0
          ? 'This source published no screenshots.'
          : 'The screenshots for this app could not be loaded. Open the repository to view them.'}
      </p>
    );
  }

  return (
    <section aria-label={`${appName} screenshots`} className="flex flex-col gap-2">
      <h2 className="text-caption text-muted-foreground uppercase tracking-wide">Screenshots</h2>
      <div className="custom-scroll flex snap-x gap-3 overflow-x-auto pb-2">
        {usable.map((url, index) => (
          <div
            className="aspect-9/16 h-64 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-surface-raised"
            key={url}
          >
            <img
              alt={`${appName} screenshot ${index + 1} of ${usable.length}`}
              className="size-full object-contain"
              height={SHOT_HEIGHT}
              loading="lazy"
              onError={() => {
                setBrokenUrls((previous) => new Set(previous).add(url));
              }}
              src={url}
              width={SHOT_WIDTH}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
