import { useEffect, useState } from 'react';
import type { backend } from '@/desktop/models';
import { EventsOn } from '@/desktop/runtime';

export function useHostSetupProgress() {
  const [progress, setProgress] = useState<backend.HostSetupProgress | null>(null);

  useEffect(() => EventsOn<backend.HostSetupProgress>('host-setup:progress', setProgress), []);

  return progress;
}
