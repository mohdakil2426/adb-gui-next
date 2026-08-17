import { isMac } from '@/shared/utils/platform';

/**
 * Modifier label for shortcuts that accept either Ctrl or Cmd.
 * `Ctrl+\`` is deliberately **not** one of them — the bottom-panel handler tests
 * `ctrlKey` only, so it really is Ctrl on macOS too.
 */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

export interface ShortcutHelp {
  keys: string[];
  label: string;
  scope: string;
}

/**
 * The app's keyboard surface, in one place. Rendered by the palette's
 * "Keyboard shortcuts" entry — the app previously had no shortcut reference at all.
 */
export const SHORTCUT_HELP: ShortcutHelp[] = [
  { keys: [MOD_KEY, 'K'], label: 'Open command palette', scope: 'Global' },
  { keys: [MOD_KEY, 'B'], label: 'Toggle sidebar', scope: 'Global' },
  { keys: ['Ctrl', '`'], label: 'Toggle bottom panel', scope: 'Global' },
  { keys: ['↑', '↓'], label: 'Move selection', scope: 'Command palette' },
  { keys: ['Enter'], label: 'Run selection', scope: 'Command palette' },
  { keys: ['Esc'], label: 'Close', scope: 'Command palette' },
  { keys: [MOD_KEY, 'N'], label: 'New file', scope: 'File Explorer' },
  { keys: [MOD_KEY, 'Shift', 'N'], label: 'New folder', scope: 'File Explorer' },
  { keys: [MOD_KEY, 'F'], label: 'Focus search', scope: 'File Explorer' },
  { keys: [MOD_KEY, 'A'], label: 'Select all', scope: 'File Explorer' },
  { keys: [MOD_KEY, 'C'], label: 'Copy', scope: 'File Explorer' },
  { keys: [MOD_KEY, 'X'], label: 'Cut', scope: 'File Explorer' },
  { keys: [MOD_KEY, 'V'], label: 'Paste', scope: 'File Explorer' },
  { keys: [MOD_KEY, 'Shift', 'C'], label: 'Copy path', scope: 'File Explorer' },
  { keys: [MOD_KEY, 'L'], label: 'Edit path', scope: 'File Explorer' },
  { keys: ['F5'], label: 'Refresh', scope: 'File Explorer' },
  { keys: ['F2'], label: 'Rename', scope: 'File Explorer' },
  { keys: ['Delete'], label: 'Delete', scope: 'File Explorer' },
  { keys: ['Enter'], label: 'Open', scope: 'File Explorer' },
  { keys: ['Alt', '←'], label: 'Back', scope: 'File Explorer' },
  { keys: ['Alt', '→'], label: 'Forward', scope: 'File Explorer' },
  { keys: ['Alt', '↑'], label: 'Parent folder', scope: 'File Explorer' },
  { keys: ['↑', '↓'], label: 'Resize panel (when the divider has focus)', scope: 'Bottom panel' },
];
