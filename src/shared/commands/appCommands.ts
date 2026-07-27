import {
  Cpu,
  Keyboard,
  Laptop,
  Logs,
  Moon,
  PanelLeft,
  SquareTerminal,
  Sun,
  Terminal,
} from 'lucide-react';
import { VIEWS } from '@/app/shell/viewConfig';
import { NAV_VIEW_ORDER, VIEW_META } from '@/shared/commands/navigation';
import { MOD_KEY } from '@/shared/commands/shortcuts';
import {
  AVAILABLE,
  blocked,
  type CommandAction,
  type CommandContext,
} from '@/shared/commands/types';
import { isLinux, isMac } from '@/shared/utils/platform';

/**
 * Jump to any of the nine views. Navigating to the view you are already on is
 * harmless, so the current one is marked rather than disabled.
 */
export function viewCommands(ctx: CommandContext): CommandAction[] {
  return NAV_VIEW_ORDER.map((view) => {
    const meta = VIEW_META[view];
    return {
      available: () => AVAILABLE,
      group: 'navigate',
      icon: meta.icon,
      id: `navigate.${view}`,
      keywords: [...meta.keywords, meta.description],
      label: meta.title,
      run: (target) => {
        target.shell.setActiveView(view);
      },
      ...(view === ctx.activeView ? { hint: 'current' } : {}),
    } satisfies CommandAction;
  });
}

const THEMES = [
  { icon: Sun, id: 'light', label: 'Light' },
  { icon: Moon, id: 'dark', label: 'Dark' },
  { icon: Laptop, id: 'system', label: 'System' },
] as const;

/** Shell-level actions: panels, sidebar, theme, host tools, shortcut reference. */
export function shellCommands(ctx: CommandContext): CommandAction[] {
  // The bottom panel is not mounted on the About page, so toggling it there
  // would silently do nothing.
  const panelAvailability = (target: CommandContext) =>
    target.activeView === VIEWS.ABOUT ? blocked('Not available on the About page') : AVAILABLE;

  const themes: CommandAction[] = THEMES.map((theme) => ({
    available: () => AVAILABLE,
    group: 'actions',
    icon: theme.icon,
    id: `shell.theme.${theme.id}`,
    keywords: ['theme', 'appearance', 'colour', 'color', 'dark', 'light'],
    label: `Theme: ${theme.label}`,
    run: (target) => {
      target.shell.setTheme(theme.id);
    },
    ...(theme.id === ctx.theme ? { hint: 'current' } : {}),
  }));

  return [
    {
      available: panelAvailability,
      group: 'actions',
      icon: Logs,
      id: 'shell.panel.logs',
      keywords: ['logs', 'output', 'console', 'panel'],
      label: 'Toggle Logs Panel',
      run: (target) => {
        target.shell.togglePanel('logs');
      },
      shortcut: ['Ctrl', '`'],
    },
    {
      available: panelAvailability,
      group: 'actions',
      icon: Terminal,
      id: 'shell.panel.shell',
      keywords: ['shell', 'adb', 'terminal', 'panel', 'command'],
      label: 'Toggle Shell Panel',
      run: (target) => {
        target.shell.togglePanel('shell');
      },
    },
    {
      available: () => AVAILABLE,
      group: 'actions',
      icon: PanelLeft,
      id: 'shell.sidebar',
      keywords: ['sidebar', 'navigation', 'collapse', 'expand'],
      label: 'Toggle Sidebar',
      run: (target) => {
        target.shell.toggleSidebar();
      },
      shortcut: [MOD_KEY, 'B'],
    },
    ...themes,
    {
      available: () => AVAILABLE,
      group: 'actions',
      icon: SquareTerminal,
      id: 'shell.launchTerminal',
      keywords: ['terminal', 'host', 'shell', 'external', 'launch'],
      label: 'Launch Host Terminal',
      run: (target) => {
        target.shell.launchTerminal();
      },
    },
    {
      available: () => (isLinux ? blocked('Not available on Linux') : AVAILABLE),
      group: 'actions',
      icon: Cpu,
      id: 'shell.deviceManager',
      keywords: ['device manager', 'system information', 'drivers', 'host'],
      label: isMac ? 'Open System Information' : 'Open Device Manager',
      run: (target) => {
        target.shell.launchDeviceManager();
      },
    },
    {
      available: () => AVAILABLE,
      group: 'actions',
      icon: Keyboard,
      id: 'shell.shortcuts',
      keywords: ['shortcuts', 'keyboard', 'keys', 'help', 'bindings'],
      label: 'Keyboard Shortcuts',
      run: (target) => {
        target.shell.showShortcuts();
      },
    },
  ];
}
