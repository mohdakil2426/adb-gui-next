import { useEffect } from 'react';

interface GlobalShortcutHandlers {
  /** Toggles the ⌘K / Ctrl+K command palette. */
  onTogglePalette?: () => void;
  /** Toggles the application theme. */
  onToggleTheme?: () => void;
}

export function useGlobalShortcuts({
  onTogglePalette,
  onToggleTheme,
}: GlobalShortcutHandlers): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isCmdK && onTogglePalette) {
        event.preventDefault();
        event.stopPropagation();
        onTogglePalette();
        return;
      }

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        return;
      }

      const isThemeHotkey =
        event.key.toLowerCase() === 'd' ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd');

      if (isThemeHotkey && onToggleTheme) {
        event.preventDefault();
        event.stopPropagation();
        onToggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onTogglePalette, onToggleTheme]);
}
