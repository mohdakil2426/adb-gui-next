import { ArrowLeft, CornerDownLeft, Keyboard } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ViewType } from '@/app/shell/viewConfig';
import { buildCommands, COMMAND_GROUPS } from '@/shared/commands/registry';
import { SHORTCUT_HELP, type ShortcutHelp } from '@/shared/commands/shortcuts';
import type { CommandAction, CommandContext, CommandShell } from '@/shared/commands/types';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useNicknameStore } from '@/shared/stores/nicknameStore';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/shared/ui/command';
import { DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';
import { useSidebar } from '@/shared/ui/sidebar';
import { cn } from '@/shared/utils/cn';

const LIST_HEIGHT = 'max-h-[300px] min-h-[220px]';
const SHORTCUT_GROUPS: Array<{ scope: string; entries: ShortcutHelp[] }> = (() => {
  const groups: Record<string, ShortcutHelp[]> = {};
  for (const item of SHORTCUT_HELP) {
    const list = groups[item.scope] ?? [];
    list.push(item);
    groups[item.scope] = list;
  }
  return Object.entries(groups).map(([scope, entries]) => ({ entries, scope }));
})();
interface PaletteRowProps {
  action: CommandAction;
  ctx: CommandContext;
  onRun: (action: CommandAction) => void;
}

function PaletteRow({ action, ctx, onRun }: PaletteRowProps) {
  const { enabled, reason } = action.available(ctx);
  const keywords = useMemo(() => [action.label, ...action.keywords], [action]);
  const Icon = action.icon;

  return (
    <CommandItem
      className={cn('gap-2.5', !enabled && 'data-[selected=true]:bg-transparent')}
      disabled={!enabled}
      keywords={keywords}
      onSelect={() => {
        onRun(action);
      }}
      value={action.id}
    >
      <Icon
        aria-hidden="true"
        className={cn('size-4 text-muted-foreground', !enabled && 'opacity-50')}
      />
      <span className={cn('truncate', !enabled && 'text-muted-foreground')}>{action.label}</span>
      {reason ? (
        <span className="ml-auto shrink-0 truncate text-caption text-warning">{reason}</span>
      ) : null}
      {enabled && action.shortcut ? (
        <CommandShortcut>
          {action.shortcut.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </CommandShortcut>
      ) : null}
      {enabled && !action.shortcut && action.hint ? (
        <span className="ml-auto shrink-0 text-caption text-muted-foreground">{action.hint}</span>
      ) : null}
    </CommandItem>
  );
}

function ShortcutsPage() {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Keyboard aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="font-medium text-body">Keyboard Shortcuts</h2>
      </div>
      <div className={cn('custom-scroll overflow-y-auto p-2', LIST_HEIGHT)}>
        {SHORTCUT_GROUPS.map(({ scope, entries }) => (
          <section className="mb-2" key={scope}>
            <h3 className="px-2 py-1.5 text-caption text-muted-foreground uppercase">{scope}</h3>
            <ul className="flex flex-col">
              {entries.map((entry) => (
                <li
                  className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 text-body"
                  key={`${scope}:${entry.label}`}
                >
                  <span className="truncate">{entry.label}</span>
                  <KbdGroup>
                    {entry.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </KbdGroup>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

interface CommandPaletteProps {
  activeView: ViewType;
  onLaunchDeviceManager: () => void;
  onLaunchTerminal: () => void;
  onOpenChange: (open: boolean) => void;
  onRefreshDevices: () => void;
  onTogglePanel: (tab: 'logs' | 'shell') => void;
  onViewChange: (view: ViewType) => void;
  open: boolean;
}

/**
 * Global ⌘K / Ctrl+K palette.
 *
 * Registry-driven: every row comes from `shared/commands`, and an action that
 * cannot run right now is rendered **disabled with the reason** instead of being
 * hidden — the "smart gate, not a dead end" pattern, generalised.
 */
export function CommandPalette({
  activeView,
  onLaunchDeviceManager,
  onLaunchTerminal,
  onOpenChange,
  onRefreshDevices,
  onTogglePanel,
  onViewChange,
  open,
}: CommandPaletteProps) {
  const [page, setPage] = useState<'commands' | 'shortcuts'>('commands');
  const [search, setSearch] = useState('');
  const keepOpenRef = useRef(false);

  const { setTheme, theme } = useTheme();
  const { toggleSidebar } = useSidebar();
  const { devices, selectedSerial, setSelectedSerial } = useDeviceStore(
    useShallow((state) => ({
      devices: state.devices,
      selectedSerial: state.selectedSerial,
      setSelectedSerial: state.setSelectedSerial,
    })),
  );
  const nicknames = useNicknameStore((state) => state.nicknames);

  const shell = useMemo<CommandShell>(
    () => ({
      closePalette: () => {
        onOpenChange(false);
      },
      launchDeviceManager: onLaunchDeviceManager,
      launchTerminal: onLaunchTerminal,
      refreshDevices: onRefreshDevices,
      selectDevice: setSelectedSerial,
      setActiveView: onViewChange,
      setTheme,
      showShortcuts: () => {
        keepOpenRef.current = true;
        setSearch('');
        setPage('shortcuts');
      },
      togglePanel: onTogglePanel,
      toggleSidebar,
    }),
    [
      onLaunchDeviceManager,
      onLaunchTerminal,
      onOpenChange,
      onRefreshDevices,
      onTogglePanel,
      onViewChange,
      setSelectedSerial,
      setTheme,
      toggleSidebar,
    ],
  );

  const ctx = useMemo<CommandContext>(
    () => ({
      activeView,
      devices,
      nicknames,
      selectedDevice: devices.find((device) => device.serial === selectedSerial) ?? null,
      selectedSerial,
      shell,
      theme: theme ?? 'system',
    }),
    [activeView, devices, nicknames, selectedSerial, shell, theme],
  );

  const groups = useMemo(() => {
    const actions = buildCommands(ctx);
    return COMMAND_GROUPS.reduce<
      Array<(typeof COMMAND_GROUPS)[number] & { actions: CommandAction[] }>
    >((acc, group) => {
      const groupActions = actions.filter((action) => action.group === group.id);
      if (groupActions.length > 0) {
        acc.push({ ...group, actions: groupActions });
      }
      return acc;
    }, []);
  }, [ctx]);

  const runAction = useCallback(
    (action: CommandAction) => {
      keepOpenRef.current = false;
      action.run(ctx);
      if (!keepOpenRef.current) {
        onOpenChange(false);
      }
    },
    [ctx, onOpenChange],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setPage('commands');
        setSearch('');
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  return (
    <CommandDialog
      aria-describedby="palette-description"
      aria-labelledby="palette-title"
      className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
      onOpenChange={handleOpenChange}
      open={open}
      showCloseButton={false}
    >
      <DialogTitle className="sr-only" id="palette-title">
        Command palette
      </DialogTitle>
      <DialogDescription className="sr-only" id="palette-description">
        Search actions, views and connected devices.
      </DialogDescription>
      {page === 'commands' ? (
        <Command loop>
          <CommandInput
            onValueChange={setSearch}
            placeholder="Search actions, views and devices…"
            value={search}
          />
          <CommandList className={LIST_HEIGHT}>
            <CommandEmpty>No matching command.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup heading={group.label} key={group.id}>
                {group.actions.map((action) => (
                  <PaletteRow action={action} ctx={ctx} key={action.id} onRun={runAction} />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      ) : (
        <ShortcutsPage />
      )}

      <div className="flex h-9 shrink-0 items-center gap-4 border-t bg-surface-raised px-3 text-caption text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          navigate
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>
            <CornerDownLeft aria-hidden="true" />
          </Kbd>
          run
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd>
          close
        </span>
        {page === 'shortcuts' ? (
          <button
            className="ml-auto flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-foreground hover:bg-accent"
            onClick={() => {
              setPage('commands');
            }}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Back to commands
          </button>
        ) : null}
      </div>
    </CommandDialog>
  );
}
