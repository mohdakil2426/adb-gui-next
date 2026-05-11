'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Watch for system theme changes and force re-render
  useEffect(() => {
    if (theme === 'system' || !theme) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => setTick((t) => t + 1);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
    return;
  }, [theme]);

  const cycleTheme = useCallback(() => {
    // Use theme instead of resolvedTheme for setting
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  }, [theme, setTheme]);

  const getIcon = () => {
    if (!mounted) {
      return <Sun className="size-4" />;
    }
    // Use theme for icon display
    if (theme === 'dark') {
      return <Moon className="size-4" />;
    }
    if (theme === 'system') {
      return <Laptop className="size-4" />;
    }
    return <Sun className="size-4" />;
  };

  const getTooltipText = () => {
    if (!mounted) {
      return 'Theme';
    }
    if (theme === 'dark') {
      return 'Dark mode';
    }
    if (theme === 'system') {
      return 'System theme';
    }
    return 'Light mode';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Button
            aria-label="Toggle theme"
            className="size-9"
            onClick={cycleTheme}
            size="icon"
            variant="ghost"
          >
            {getIcon()}
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{getTooltipText()}</p>
      </TooltipContent>
    </Tooltip>
  );
}
