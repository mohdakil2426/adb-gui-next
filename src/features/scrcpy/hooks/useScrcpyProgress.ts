import { useEffect, useState } from 'react';
import type { backend } from '@/desktop/models';
import { EventsOn } from '@/desktop/runtime';

export function useScrcpyProgress() {
  const [progress, setProgress] = useState<backend.ScrcpyDownloadProgress | null>(null);

  useEffect(
    () => EventsOn<backend.ScrcpyDownloadProgress>('scrcpy:download-progress', setProgress),
    [],
  );

  return progress;
}
