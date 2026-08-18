import {
  Bell,
  ChevronUp,
  Moon,
  Move,
  PanelLeft,
  PanelRight,
  Pin,
  PinOff,
  PowerOff,
  Sliders,
  Sun,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { backend } from '@/desktop/models';

interface ToolbarMoreMenuProps {
  isOpen: boolean;
  mode: backend.ToolbarMode;
  onAction: (actionId: string) => void;
  onClose: () => void;
  onModeChange: (mode: backend.ToolbarMode) => void;
  onOffsetChange: (offset: number) => void;
  onSideChange: (side: backend.ToolbarSide) => void;
  side: backend.ToolbarSide;
  yOffset: number;
}

export function ToolbarMoreMenu({
  isOpen,
  mode,
  onAction,
  onClose,
  onModeChange,
  onOffsetChange,
  onSideChange,
  side,
  yOffset,
}: ToolbarMoreMenuProps) {
  const [localOffset, setLocalOffset] = useState(yOffset);
  if (!isOpen) {
    return null;
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalOffset(val);
    onOffsetChange(val);
  };

  const nudgeOffset = (delta: number) => {
    const next = Math.max(-300, Math.min(500, localOffset + delta));
    setLocalOffset(next);
    onOffsetChange(next);
  };

  return (
    <div className="fade-in zoom-in-95 flex w-[285px] max-w-[285px] shrink-0 animate-in flex-col gap-2.5 rounded-xl border border-border/90 bg-[#f3f4f6]/98 p-3.5 shadow-2xl backdrop-blur-xl duration-150 dark:bg-[#1e1f22]/98">
      <div className="flex items-center justify-between border-border/60 border-b pb-2">
        <span className="font-semibold text-foreground text-xs">Extended Controls</span>
        <button
          aria-label="Close menu"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Mode Toggle: Locked vs Freeform */}
      <div className="flex flex-col gap-1.5">
        <span className="font-medium text-[11px] text-muted-foreground">Toolbar Position Mode</span>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/60 p-1">
          <button
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-medium text-xs transition-all ${
              mode === 'locked'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onModeChange('locked')}
            type="button"
          >
            <Pin className="size-3" />
            <span>Lock to Phone</span>
          </button>
          <button
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-medium text-xs transition-all ${
              mode === 'freeform'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onModeChange('freeform')}
            type="button"
          >
            <PinOff className="size-3" />
            <span>Freeform</span>
          </button>
        </div>
      </div>

      {/* Side & Vertical Adjustment when Locked */}
      {mode === 'locked' ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[11px] text-muted-foreground">Dock Side</span>
            <div className="flex gap-1">
              <button
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                  side === 'left'
                    ? 'bg-surface font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => onSideChange('left')}
                type="button"
              >
                <PanelLeft className="size-3" />
                <span>Left</span>
              </button>
              <button
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                  side === 'right'
                    ? 'bg-surface font-semibold text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => onSideChange('right')}
                type="button"
              >
                <PanelRight className="size-3" />
                <span>Right</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Vertical Position</span>
              <span className="font-mono text-[10px] text-muted-foreground">{localOffset}px</span>
            </div>
            <input
              className="h-1.5 w-full cursor-pointer accent-primary"
              max="400"
              min="-200"
              onChange={handleSliderChange}
              step="10"
              type="range"
              value={localOffset}
            />
            <div className="flex justify-between pt-1 text-[10px] text-muted-foreground">
              <button
                className="rounded bg-muted px-1.5 py-0.5 hover:text-foreground"
                onClick={() => nudgeOffset(-20)}
                type="button"
              >
                ▲ Up
              </button>
              <button
                className="rounded bg-muted px-1.5 py-0.5 hover:text-foreground"
                onClick={() => {
                  setLocalOffset(20);
                  onOffsetChange(20);
                }}
                type="button"
              >
                Reset
              </button>
              <button
                className="rounded bg-muted px-1.5 py-0.5 hover:text-foreground"
                onClick={() => nudgeOffset(20)}
                type="button"
              >
                ▼ Down
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
          <Move className="size-3.5 shrink-0" />
          <span>Drag the top handle to reposition anywhere on your desktop.</span>
        </div>
      )}

      {/* System Actions */}
      <div className="flex flex-col gap-1 border-border/60 border-t pt-2">
        <span className="font-medium text-[11px] text-muted-foreground">Device Actions</span>
        <div className="grid grid-cols-1 gap-1 text-xs">
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-foreground hover:bg-muted/80"
            onClick={() => onAction('notifications')}
            type="button"
          >
            <Bell className="size-3.5 text-muted-foreground" />
            <span>Pull Notifications</span>
          </button>
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-foreground hover:bg-muted/80"
            onClick={() => onAction('quick-settings')}
            type="button"
          >
            <Sliders className="size-3.5 text-muted-foreground" />
            <span>Quick Settings Drawer</span>
          </button>
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-foreground hover:bg-muted/80"
            onClick={() => onAction('collapse-panels')}
            type="button"
          >
            <ChevronUp className="size-3.5 text-muted-foreground" />
            <span>Collapse Panels</span>
          </button>
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-foreground hover:bg-muted/80"
            onClick={() => onAction('turn-off-screen')}
            type="button"
          >
            <Moon className="size-3.5 text-muted-foreground" />
            <span>Turn Off Physical Screen</span>
          </button>
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-foreground hover:bg-muted/80"
            onClick={() => onAction('wake-up')}
            type="button"
          >
            <Sun className="size-3.5 text-muted-foreground" />
            <span>Wake Up Device</span>
          </button>
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
            onClick={() => onAction('stop-session')}
            type="button"
          >
            <PowerOff className="size-3.5" />
            <span>Stop Scrcpy Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
