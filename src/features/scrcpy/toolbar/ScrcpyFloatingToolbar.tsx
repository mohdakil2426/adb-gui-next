import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow, LogicalSize } from '@tauri-apps/api/webviewWindow';
import {
  Maximize2,
  Minus,
  Pin,
  PinOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ScrcpyCloseToolbar,
  ScrcpyGetToolbarState,
  ScrcpyRotateDevice,
  ScrcpySendKeyevent,
  ScrcpySendStatusbar,
  ScrcpySetToolbarMode,
  ScrcpySetToolbarOffset,
  ScrcpySetToolbarSide,
  ScrcpyStop,
  ScrcpyTakeScreenshot,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { ToolbarButton } from '@/features/scrcpy/toolbar/ToolbarButton';
import { ToolbarMoreMenu } from '@/features/scrcpy/toolbar/ToolbarMoreMenu';
import { MAIN_TOOLBAR_ACTIONS } from '@/features/scrcpy/toolbar/toolbarActions';

export function ScrcpyFloatingToolbar() {
  const [serial, setSerial] = useState<string>('');
  const [mode, setMode] = useState<backend.ToolbarMode>('locked');
  const [side, setSide] = useState<backend.ToolbarSide>('left');
  const [yOffset, setYOffset] = useState<number>(20);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Initialize from URL params and load backend state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('serial') || '';
    const m = (params.get('mode') as backend.ToolbarMode) || 'locked';
    setSerial(s);
    setMode(m);

    if (s) {
      ScrcpyGetToolbarState(s)
        .then((state) => {
          if (state) {
            setMode(state.mode);
            setSide(state.side);
            setYOffset(state.yOffset);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleAction = async (actionId: string) => {
    setActiveAction(actionId);
    setTimeout(() => setActiveAction(null), 200);

    try {
      switch (actionId) {
        case 'power':
          // KEYCODE_POWER = 26
          await ScrcpySendKeyevent(serial, 26);
          break;
        case 'vol-up':
          // KEYCODE_VOLUME_UP = 24
          await ScrcpySendKeyevent(serial, 24);
          break;
        case 'vol-down':
          // KEYCODE_VOLUME_DOWN = 25
          await ScrcpySendKeyevent(serial, 25);
          break;
        case 'camera': {
          const path = await ScrcpyTakeScreenshot(serial);
          toast.success('Screenshot saved', { description: path });
          break;
        }
        case 'zoom':
          // Window resize / fit / toggle 1:1
          await ScrcpySendKeyevent(serial, 0); // Trigger resize check in backend
          toast.info('Adjusted Scrcpy Window Size');
          break;
        case 'rotate-ccw':
          await ScrcpyRotateDevice(serial, 'counter-clockwise');
          break;
        case 'rotate-cw':
          await ScrcpyRotateDevice(serial, 'clockwise');
          break;
        case 'back':
          // KEYCODE_BACK = 4
          await ScrcpySendKeyevent(serial, 4);
          break;
        case 'home':
          // KEYCODE_HOME = 3
          await ScrcpySendKeyevent(serial, 3);
          break;
        case 'recents':
          // KEYCODE_APP_SWITCH = 187
          await ScrcpySendKeyevent(serial, 187);
          break;
        case 'notifications':
          await ScrcpySendStatusbar(serial, 'expand-notifications');
          break;
        case 'quick-settings':
          await ScrcpySendStatusbar(serial, 'expand-settings');
          break;
        case 'collapse-panels':
          await ScrcpySendStatusbar(serial, 'collapse');
          break;
        case 'turn-off-screen':
          // KEYCODE_SLEEP = 223
          await ScrcpySendKeyevent(serial, 223);
          break;
        case 'wake-up':
          // KEYCODE_WAKEUP = 224
          await ScrcpySendKeyevent(serial, 224);
          break;
        case 'stop-session':
          await ScrcpyStop(serial);
          await ScrcpyCloseToolbar(serial);
          break;
        default:
          break;
      }
    } catch (err) {
      toast.error('Action failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleModeToggle = async () => {
    const nextMode: backend.ToolbarMode = mode === 'locked' ? 'freeform' : 'locked';
    setMode(nextMode);
    if (serial) {
      await ScrcpySetToolbarMode(serial, nextMode).catch(() => {});
    }
    toast.info(nextMode === 'locked' ? 'Toolbar locked to phone' : 'Toolbar in freeform mode');
  };

  const handleSideChange = async (nextSide: backend.ToolbarSide) => {
    setSide(nextSide);
    if (serial) {
      await ScrcpySetToolbarSide(serial, nextSide).catch(() => {});
    }
  };

  const handleOffsetChange = async (nextOffset: number) => {
    setYOffset(nextOffset);
    if (serial) {
      await ScrcpySetToolbarOffset(serial, nextOffset).catch(() => {});
    }
  };

  const handleClose = async () => {
    if (serial) {
      await ScrcpyCloseToolbar(serial).catch(() => {});
    }
  };

  const handleToggleMore = async () => {
    const next = !isMoreOpen;
    setIsMoreOpen(next);
    try {
      const win = getCurrentWebviewWindow();
      if (next) {
        await win.setSize(new LogicalSize(340, 520));
      } else {
        await win.setSize(new LogicalSize(44, 490));
      }
    } catch {}
  };

  const handleToggleMinimize = async (min: boolean) => {
    setIsMinimized(min);
    try {
      const win = getCurrentWebviewWindow();
      if (min) {
        await win.setSize(new LogicalSize(38, 38));
      } else {
        await win.setSize(new LogicalSize(44, 490));
      }
    } catch {}
  };

  if (isMinimized) {
    return (
      <div
        data-tauri-drag-region
        className="flex size-9 cursor-move items-center justify-center rounded-lg border border-border/80 bg-[#f3f4f6]/95 dark:bg-[#1e1f22]/95 shadow-xl backdrop-blur-md transition-all hover:bg-surface-raised"
      >
        <button
          type="button"
          onClick={() => handleToggleMinimize(false)}
          title="Expand Toolbar"
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex select-none items-start gap-2 bg-transparent p-0">
      {/* Main Action Strip */}
      <div className="flex w-10 flex-col items-center gap-0.5 rounded-lg border border-border/80 bg-[#f3f4f6]/95 dark:bg-[#1e1f22]/95 p-1 shadow-2xl backdrop-blur-lg">
        {/* Top Window Header: Drag Region, Minimize, Mode, Close */}
        <div
          data-tauri-drag-region
          className="flex w-full cursor-move items-center justify-between border-border/40 border-b px-0.5 pb-1 text-muted-foreground"
        >
          <button
            type="button"
            onClick={() => handleToggleMinimize(true)}
            title="Minimize"
            className="flex size-4 items-center justify-center rounded hover:bg-muted hover:text-foreground"
          >
            <Minus className="size-3" />
          </button>

          <button
            type="button"
            onClick={handleModeToggle}
            title={mode === 'locked' ? 'Locked to phone (Click to unlock)' : 'Freeform (Click to lock to phone)'}
            className={`flex size-4 items-center justify-center rounded transition-colors ${
              mode === 'locked'
                ? 'text-primary hover:bg-primary/10'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {mode === 'locked' ? (
              <Pin className="size-2.5 fill-current" />
            ) : (
              <PinOff className="size-2.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            title="Close Toolbar"
            className="flex size-4 items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </div>

        {/* Main Action Buttons */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          {MAIN_TOOLBAR_ACTIONS.map((action) => (
            <ToolbarButton
              key={action.id}
              icon={action.icon}
              label={action.label}
              shortcut={action.shortcut}
              description={action.description}
              isActive={activeAction === action.id}
              onClick={() => handleAction(action.id)}
            />
          ))}

          {/* More / Extended Controls Menu Trigger */}
          <ToolbarButton
            icon="more"
            label="Extended Controls"
            isActive={isMoreOpen}
            onClick={handleToggleMore}
          />
        </div>
      </div>

      {/* Extended Controls Popover */}
      {isMoreOpen ? (
        <ToolbarMoreMenu
          isOpen={isMoreOpen}
          onClose={() => {
            setIsMoreOpen(false);
            try {
              getCurrentWebviewWindow().setSize(new LogicalSize(44, 490));
            } catch {}
          }}
          mode={mode}
          side={side}
          yOffset={yOffset}
          onModeChange={handleModeToggle}
          onSideChange={handleSideChange}
          onOffsetChange={handleOffsetChange}
          onAction={(actionId) => {
            setIsMoreOpen(false);
            try {
              getCurrentWebviewWindow().setSize(new LogicalSize(44, 490));
            } catch {}
            handleAction(actionId);
          }}
        />
      ) : null}
    </div>
  );
