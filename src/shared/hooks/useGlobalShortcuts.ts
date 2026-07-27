import { useEffect } from 'react';

interface GlobalShortcutHandlers {
  /** Toggles the ⌘K / Ctrl+K command palette. */
  onTogglePalette: () => void;
}

/**
 * Application-wide keyboard shortcuts that are not already owned by a component.
 *
 * `Ctrl/⌘+B` (sidebar) lives in `shared/ui/sidebar` and `Ctrl+\`` (bottom panel)
 * lives in `BottomPanel` — both keep working untouched. This hook adds only the
 * palette binding.
 *
 * It listens in the **capture** phase and stops propagation so the palette wins
 * over view-local `Ctrl+K` handlers (the Marketplace search box binds the same
 * chord on `window` in the bubble phase). Without this both would fire.
 */
export function useGlobalShortcuts({ onTogglePalette }: GlobalShortcutHandlers): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isPaletteChord =
        (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k';
      if (!isPaletteChord) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onTogglePalette();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onTogglePalette]);
}
