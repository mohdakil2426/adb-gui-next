import { LogicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Maximize2, Minus, Pin, PinOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ScrcpyCloseToolbar,
  ScrcpyGetToolbarState,
  ScrcpySetToolbarMode,
  ScrcpySetToolbarOffset,
  ScrcpySetToolbarSide,
  ScrcpySetToolbarSize,
  ScrcpyStop,
  ScrcpyToolbarAction,
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
      if (actionId === 'stop-session') {
        await ScrcpyStop(serial);
        await ScrcpyCloseToolbar(serial);
      } else {
        await ScrcpyToolbarAction(serial, actionId);
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
    const targetW = next ? 390 : 58;
    const targetH = next ? 580 : 540;
    try {
      await getCurrentWebviewWindow().setSize(new LogicalSize(targetW, targetH));
    } catch {}
    if (serial) {
      await ScrcpySetToolbarSize(serial, targetW, targetH).catch(() => {});
    }
  };

  const handleToggleMinimize = async (min: boolean) => {
    setIsMinimized(min);
    const targetW = min ? 42 : 58;
    const targetH = min ? 42 : 540;
    try {
      await getCurrentWebviewWindow().setSize(new LogicalSize(targetW, targetH));
    } catch {}
    if (serial) {
      await ScrcpySetToolbarSize(serial, targetW, targetH).catch(() => {});
    }
  };

  if (isMinimized) {
    return (
      <div
        className="flex size-10 cursor-move items-center justify-center rounded-xl border border-border/80 bg-[#f3f4f6]/95 shadow-xl backdrop-blur-md transition-all hover:bg-surface-raised dark:bg-[#1e1f22]/95"
        data-tauri-drag-region
      >
        <button
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          onClick={() => handleToggleMinimize(false)}
          title="Expand Toolbar"
          type="button"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex select-none items-start gap-2 bg-transparent p-0">
      {/* Main Action Strip */}
      <div className="flex w-[52px] flex-col items-center gap-1 rounded-xl border border-border/80 bg-[#f3f4f6]/95 p-1.5 shadow-2xl backdrop-blur-lg dark:bg-[#1e1f22]/95">
        {/* Top Window Header: Drag Region, Minimize, Mode, Close */}
        <div
          className="flex w-full cursor-move items-center justify-between border-border/40 border-b px-1 pb-1.5 text-muted-foreground"
          data-tauri-drag-region
        >
          <button
            className="flex size-5 items-center justify-center rounded hover:bg-muted hover:text-foreground"
            onClick={() => handleToggleMinimize(true)}
            title="Minimize"
            type="button"
          >
            <Minus className="size-3.5" />
          </button>

          <button
            className={`flex size-5 items-center justify-center rounded transition-colors ${
              mode === 'locked'
                ? 'text-primary hover:bg-primary/10'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            onClick={handleModeToggle}
            title={
              mode === 'locked'
                ? 'Locked to phone (Click to unlock)'
                : 'Freeform (Click to lock to phone)'
            }
            type="button"
          >
            {mode === 'locked' ? (
              <Pin className="size-3 fill-current" />
            ) : (
              <PinOff className="size-3" />
            )}
          </button>

          <button
            className="flex size-5 items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive"
            onClick={handleClose}
            title="Close Toolbar"
            type="button"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Main Action Buttons */}
        <div className="flex flex-col items-center gap-1 pt-1">
          {MAIN_TOOLBAR_ACTIONS.map((action) => (
            <ToolbarButton
              description={action.description}
              icon={action.icon}
              isActive={activeAction === action.id}
              key={action.id}
              label={action.label}
              onClick={() => handleAction(action.id)}
              shortcut={action.shortcut}
            />
          ))}

          {/* More / Extended Controls Menu Trigger */}
          <ToolbarButton
            icon="more"
            isActive={isMoreOpen}
            label="Extended Controls"
            onClick={handleToggleMore}
          />
        </div>
      </div>

      {/* Extended Controls Popover */}
      {isMoreOpen ? (
        <ToolbarMoreMenu
          isOpen={isMoreOpen}
          mode={mode}
          onAction={(actionId) => {
            if (actionId === 'stop-session') {
              setIsMoreOpen(false);
              try {
                getCurrentWebviewWindow().setSize(new LogicalSize(58, 540));
              } catch {}
              if (serial) {
                ScrcpySetToolbarSize(serial, 58, 540).catch(() => {});
              }
            }
            handleAction(actionId);
          }}
          onClose={() => {
            setIsMoreOpen(false);
            try {
              getCurrentWebviewWindow().setSize(new LogicalSize(58, 540));
            } catch {}
            if (serial) {
              ScrcpySetToolbarSize(serial, 58, 540).catch(() => {});
            }
          }}
          onModeChange={handleModeToggle}
          onOffsetChange={handleOffsetChange}
          onSideChange={handleSideChange}
          side={side}
          yOffset={yOffset}
        />
      ) : null}
    </div>
  );
}
