import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Maximize2, Minus, Pin, PinOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ScrcpyCloseToolbar,
  ScrcpyGetToolbarState,
  ScrcpySetToolbarMode,
  ScrcpySetToolbarOffset,
  ScrcpySetToolbarSide,
  ScrcpySetToolbarSize,
  ScrcpyStop,
  ScrcpyToolbarAction,
} from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { MAIN_TOOLBAR_ACTIONS } from "@/features/scrcpy/toolbar/toolbar-actions";
import { ToolbarButton } from "@/features/scrcpy/toolbar/toolbar-button";
import { ToolbarMoreMenu } from "@/features/scrcpy/toolbar/toolbar-more-menu";
import { handleError } from "@/shared/utils/error-handler";

const getInitialParams = () => {
  if (typeof window === "undefined") {
    return { mode: "locked" as backend.ToolbarMode, serial: "" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    mode: (params.get("mode") as backend.ToolbarMode) || "locked",
    serial: params.get("serial") || "",
  };
};

export const ScrcpyFloatingToolbar = () => {
  const [initialParams] = useState(getInitialParams);
  const serialRef = useRef<string>(initialParams.serial);
  const [mode, setMode] = useState<backend.ToolbarMode>(initialParams.mode);
  const [side, setSide] = useState<backend.ToolbarSide>("left");
  const [yOffset, setYOffset] = useState<number>(20);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Initialize and load backend state
  useEffect(() => {
    const s = initialParams.serial;
    if (!s) {
      return;
    }
    const loadState = async () => {
      try {
        const state = await ScrcpyGetToolbarState(s);
        if (state) {
          setMode(state.mode);
          setSide(state.side);
          setYOffset(state.yOffset);
        }
      } catch (error) {
        handleError("Scrcpy toolbar state", error);
      }
    };
    void loadState();
  }, [initialParams.serial]);

  const handleAction = async (actionId: string) => {
    setActiveAction(actionId);
    setTimeout(() => setActiveAction(null), 200);

    try {
      const serial = serialRef.current;
      if (actionId === "stop-session") {
        await ScrcpyStop(serial);
        await ScrcpyCloseToolbar(serial);
      } else {
        await ScrcpyToolbarAction(serial, actionId);
      }
    } catch (error) {
      toast.error("Action failed", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleModeToggle = async () => {
    const nextMode: backend.ToolbarMode = mode === "locked" ? "freeform" : "locked";
    setMode(nextMode);
    const serial = serialRef.current;
    if (serial) {
      try {
        await ScrcpySetToolbarMode(serial, nextMode);
      } catch (error) {
        handleError("Scrcpy set toolbar mode", error);
      }
    }
    toast.info(nextMode === "locked" ? "Toolbar locked to phone" : "Toolbar in freeform mode");
  };

  const handleSideChange = async (nextSide: backend.ToolbarSide) => {
    setSide(nextSide);
    const serial = serialRef.current;
    if (serial) {
      try {
        await ScrcpySetToolbarSide(serial, nextSide);
      } catch (error) {
        handleError("Scrcpy set toolbar side", error);
      }
    }
  };

  const handleOffsetChange = async (nextOffset: number) => {
    setYOffset(nextOffset);
    const serial = serialRef.current;
    if (serial) {
      try {
        await ScrcpySetToolbarOffset(serial, nextOffset);
      } catch (error) {
        handleError("Scrcpy set toolbar offset", error);
      }
    }
  };

  const handleClose = async () => {
    const serial = serialRef.current;
    if (serial) {
      try {
        await ScrcpyCloseToolbar(serial);
      } catch (error) {
        handleError("Scrcpy close toolbar", error);
      }
    }
  };

  const handleToggleMore = async () => {
    const next = !isMoreOpen;
    setIsMoreOpen(next);
    const targetW = next ? 390 : 58;
    const targetH = next ? 580 : 540;
    try {
      await getCurrentWebviewWindow().setSize(new LogicalSize(targetW, targetH));
    } catch {
      // Ignore window resize error
    }
    const serial = serialRef.current;
    if (serial) {
      try {
        await ScrcpySetToolbarSize(serial, targetW, targetH);
      } catch (error) {
        handleError("Scrcpy set toolbar size", error);
      }
    }
  };

  const handleToggleMinimize = async (min: boolean) => {
    setIsMinimized(min);
    const targetW = min ? 42 : 58;
    const targetH = min ? 42 : 540;
    try {
      await getCurrentWebviewWindow().setSize(new LogicalSize(targetW, targetH));
    } catch {
      // Ignore window resize error
    }
    const serial = serialRef.current;
    if (serial) {
      try {
        await ScrcpySetToolbarSize(serial, targetW, targetH);
      } catch (error) {
        handleError("Scrcpy set toolbar size", error);
      }
    }
  };
  if (isMinimized) {
    return (
      <div
        className="flex size-10 cursor-move items-center justify-center rounded-xl border border-border/80 bg-[#f3f4f6]/95 shadow-xl backdrop-blur-md transition-colors hover:bg-surface-raised dark:bg-[#1e1f22]/95"
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
              mode === "locked"
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            onClick={handleModeToggle}
            title={
              mode === "locked"
                ? "Locked to phone (Click to unlock)"
                : "Freeform (Click to lock to phone)"
            }
            type="button"
          >
            {mode === "locked" ? (
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
          onAction={async (actionId) => {
            if (actionId === "stop-session") {
              setIsMoreOpen(false);
              try {
                await getCurrentWebviewWindow().setSize(new LogicalSize(58, 540));
              } catch {
                // Ignore window resize error
              }
              if (serialRef.current) {
                try {
                  await ScrcpySetToolbarSize(serialRef.current, 58, 540);
                } catch (error) {
                  handleError("Scrcpy set toolbar size", error);
                }
              }
            }
            handleAction(actionId);
          }}
          onClose={async () => {
            setIsMoreOpen(false);
            try {
              await getCurrentWebviewWindow().setSize(new LogicalSize(58, 540));
            } catch {
              // Ignore window resize error
            }
            if (serialRef.current) {
              try {
                await ScrcpySetToolbarSize(serialRef.current, 58, 540);
              } catch (error) {
                handleError("Scrcpy set toolbar size", error);
              }
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
};
