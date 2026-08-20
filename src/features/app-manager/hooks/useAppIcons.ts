import { useEffect, useRef, useState } from 'react';
import { GetAppIcons } from '@/desktop/backend';
import { handleError } from '@/shared/utils/errorHandler';

const MAX_BATCH = 24;

export function useAppIcons(serial: string | null, packageNames: string[]) {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const loadedRef = useRef(new Set<string>());
  const serialRef = useRef(serial);

  const key = packageNames.join('\0');

  useEffect(() => {
    if (serialRef.current !== serial) {
      serialRef.current = serial;
      loadedRef.current = new Set();
      setIcons({});
    }
    if (!(serial && key)) {
      return;
    }

    const names = key.split('\0');
    const missing = names.filter((name) => !loadedRef.current.has(name)).slice(0, MAX_BATCH);
    if (missing.length === 0) {
      return;
    }

    for (const name of missing) {
      loadedRef.current.add(name);
    }

    let cancelled = false;
    void GetAppIcons(missing, serial)
      .then((rows) => {
        if (cancelled || serialRef.current !== serial) {
          return;
        }
        const updates: Record<string, string> = {};
        for (const row of rows) {
          if (row.dataBase64 && row.mime) {
            updates[row.packageName] = `data:${row.mime};base64,${row.dataBase64}`;
          }
        }
        if (Object.keys(updates).length > 0) {
          setIcons((prev) => ({ ...prev, ...updates }));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          handleError('App icons', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, serial]);

  return icons;
}
