import { useCallback, useState } from 'react';
import { VIEWS, type ViewType } from '@/app/shell/viewConfig';

const STORAGE_KEY = 'adb-gui-next.activeView';

function readStoredActiveView(): ViewType {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return VIEWS.DASHBOARD;
    }
    const values = Object.values(VIEWS) as string[];
    if (values.includes(raw)) {
      return raw as ViewType;
    }
  } catch {
    /* private mode / quota */
  }
  return VIEWS.DASHBOARD;
}

/** Persist shell view id across reloads (no React Router). */
export function usePersistedActiveView() {
  const [activeView, setActiveViewState] = useState<ViewType>(readStoredActiveView);

  const setActiveView = useCallback((view: ViewType) => {
    setActiveViewState(view);
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, []);

  return { activeView, setActiveView };
}
