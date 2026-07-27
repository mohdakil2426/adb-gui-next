'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCallback, useSyncExternalStore } from 'react';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

/** next-themes default storageKey — keep in sync with ThemeProvider. */
const THEME_STORAGE_KEY = 'theme';

function subscribeThemeStorage(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

function getThemeSnapshot(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerThemeSnapshot(): string | null {
  return null;
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  // Read storage before paint (Tauri SPA; no SSR hydrate). Prefer live next-themes once ready.
  const storedTheme = useSyncExternalStore(
    subscribeThemeStorage,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const activeTheme = theme ?? storedTheme ?? 'system';

  const cycleTheme = useCallback(() => {
    if (activeTheme === 'light') {
      setTheme('dark');
    } else if (activeTheme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  }, [activeTheme, setTheme]);

  const getIcon = () => {
    if (activeTheme === 'dark') {
      return <Moon aria-hidden="true" className="size-4" />;
    }
    if (activeTheme === 'system') {
      return <Laptop aria-hidden="true" className="size-4" />;
    }
    return <Sun aria-hidden="true" className="size-4" />;
  };

  const getTooltipText = () => {
    if (activeTheme === 'dark') {
      return 'Dark mode';
    }
    if (activeTheme === 'system') {
      return 'System theme';
    }
    return 'Light mode';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Toggle theme"
          onClick={cycleTheme}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {getIcon()}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{getTooltipText()}</p>
      </TooltipContent>
    </Tooltip>
  );
}
