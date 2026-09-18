import { useEffect, useRef } from "react";

import {
  MAX_LEFT_WIDTH,
  MIN_LEFT_WIDTH,
} from "@/features/file-explorer/model/file-explorer-constants";
import { cn } from "@/shared/utils/cn";

interface Props {
  isResizing: boolean;
  leftWidth: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
}

export const FileExplorerTreeResizeHandle = ({
  isResizing,
  leftWidth,
  onKeyDown,
  onPointerDown,
}: Props) => {
  const hrRef = useRef<HTMLHRElement>(null);

  useEffect(() => {
    const el = hrRef.current;
    if (!el) {
      return;
    }
    el.tabIndex = 0;
    const handleKeyDown = (e: KeyboardEvent) => {
      onKeyDown(e as unknown as React.KeyboardEvent<HTMLElement>);
    };
    const handlePointerDown = (e: PointerEvent) => {
      onPointerDown(e as unknown as React.PointerEvent<HTMLElement>);
    };
    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("pointerdown", handlePointerDown);
    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onKeyDown, onPointerDown]);

  return (
    <hr
      aria-label="Resize tree panel"
      aria-orientation="vertical"
      aria-valuemax={MAX_LEFT_WIDTH}
      aria-valuemin={MIN_LEFT_WIDTH}
      aria-valuenow={leftWidth}
      className={cn(
        "group relative z-10 m-0 flex h-full w-3 shrink-0 cursor-col-resize justify-center border-0 bg-transparent p-0 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
        "before:h-full before:w-px before:bg-border before:transition-colors before:duration-90 before:ease-standard group-hover:before:bg-primary/60 group-active:before:bg-primary",
        isResizing && "select-none before:bg-primary"
      )}
      ref={hrRef}
    />
  );
};
