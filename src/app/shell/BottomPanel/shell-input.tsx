import type React from "react";
import { memo, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ExecuteCliCommand } from "@/desktop/backend";
import { useDeviceStore } from "@/shared/stores/device-store";
import { useShellStore } from "@/shared/stores/shell-store";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/shared/ui/input-group";
import { debugLog } from "@/shared/utils/debug";
import { handleError } from "@/shared/utils/error-handler";
import { shellCommandSchema } from "@/shared/utils/schemas";

/**
 * Owns the command draft and in-flight state so that keystrokes never re-render
 * the (potentially multi-megabyte) transcript rendered by its sibling.
 */
export const ShellInput = memo(function ShellInput() {
  const { commandHistory, addHistoryEntry, addCommand } = useShellStore(
    useShallow((state) => ({
      addCommand: state.addCommand,
      addHistoryEntry: state.addHistoryEntry,
      commandHistory: state.commandHistory,
    }))
  );
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Index into commandHistory for ArrowUp/Down recall — handler-only, not rendered.
  const historyIndexRef = useRef(commandHistory.length);

  const navigateHistory = (direction: "up" | "down") => {
    if (commandHistory.length === 0) {
      return;
    }

    const newIndex =
      direction === "up"
        ? Math.max(0, historyIndexRef.current - 1)
        : Math.min(commandHistory.length, historyIndexRef.current + 1);
    historyIndexRef.current = newIndex;

    if (newIndex === commandHistory.length) {
      setCommand("");
    } else {
      setCommand(commandHistory[newIndex] ?? "");
    }
  };

  const executeCommand = async (trimmedCommand: string) => {
    // Validate command prefix before any backend interaction
    const parsed = shellCommandSchema.safeParse(trimmedCommand);
    if (!parsed.success) {
      const errorText = parsed.error.issues[0]?.message ?? "Unknown error";
      addHistoryEntry({ text: trimmedCommand, type: "command" });
      addHistoryEntry({ text: errorText, type: "error" });
      setCommand("");
      return;
    }

    if (commandHistory.at(-1) !== trimmedCommand) {
      addCommand(trimmedCommand);
    }
    historyIndexRef.current = commandHistory.length + 1;

    setIsLoading(true);
    setCommand("");

    addHistoryEntry({ text: trimmedCommand, type: "command" });

    try {
      debugLog(`Executing shell command: ${trimmedCommand}`);
      const res = await ExecuteCliCommand(trimmedCommand, selectedSerial);
      const text = (res.stdout || res.output || res.stderr || "").trim() || "(No output)";
      if (res.exitCode !== 0 && !res.success && res.stderr) {
        addHistoryEntry({ text: res.stderr.trim(), type: "error" });
      } else {
        addHistoryEntry({ text, type: "result" });
      }
    } catch (error) {
      handleError("Shell Command", error);
      addHistoryEntry({
        text: error instanceof Error ? error.message : String(error),
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateHistory("up");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateHistory("down");
      return;
    }

    if (e.key !== "Enter" || isLoading || command.trim() === "") {
      return;
    }

    e.preventDefault();
    await executeCommand(command.trim());
  };

  // Re-focus input after command finishes
  useEffect(() => {
    if (!isLoading) {
      document.querySelector<HTMLInputElement>("#shell-panel-input")?.focus();
    }
  }, [isLoading]);

  // Sync history index with command history
  useEffect(() => {
    historyIndexRef.current = commandHistory.length;
  }, [commandHistory.length]);

  return (
    <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: "var(--terminal-border)" }}>
      <InputGroup className="border-0 bg-transparent shadow-none">
        <InputGroupAddon>
          <InputGroupText
            className="select-none font-mono font-semibold text-sm"
            style={{ color: "var(--terminal-log-info)" }}
          >
            $
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Shell Command"
          autoComplete="off"
          autoFocus
          className="font-mono text-[12px]"
          disabled={isLoading}
          id="shell-panel-input"
          name="shell-command"
          onChange={(e) => {
            setCommand(e.target.value);
            historyIndexRef.current = commandHistory.length;
          }}
          onKeyDown={handleKeyDown}
          placeholder="adb devices, adb shell ls, fastboot devices…"
          spellCheck={false}
          style={{ color: "var(--terminal-fg)" }}
          value={command}
        />
      </InputGroup>
    </div>
  );
});
