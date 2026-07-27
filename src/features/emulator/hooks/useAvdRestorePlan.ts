import { useEffect, useState } from 'react';
import { GetAvdRestorePlan } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useEmulatorManagerStore } from '@/features/emulator/model/emulatorManagerStore';

/**
 * Keeps the store's restore plan in step with the selected AVD.
 *
 * The plan lives in the store because the Restore tab and the confirmation
 * dialog both read it; this hook owns only the fetch and its in-flight flag.
 * A failed read clears the plan rather than leaving the previous AVD's files on
 * screen — restoring the wrong emulator is exactly the mistake to prevent.
 */
export function useAvdRestorePlan(avd: backend.AvdSummary | null): boolean {
  const setRestorePlan = useEmulatorManagerStore((state) => state.setRestorePlan);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!avd?.ramdiskPath) {
      setRestorePlan(null);
      return;
    }

    setIsLoading(true);
    GetAvdRestorePlan(avd.name)
      .then((plan) => {
        if (!cancelled) {
          setRestorePlan(plan);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRestorePlan(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [avd, setRestorePlan]);

  return isLoading;
}
