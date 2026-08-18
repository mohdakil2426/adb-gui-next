import type React from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ExecuteCliCommand } from '@/desktop/backend';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useShellStore } from '@/shared/stores/shellStore';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/shared/ui/input-group';
import { debugLog } from '@/shared/utils/debug';
import { handleError } from '@/shared/utils/errorHandler';
import { shellCommandSchema } from '@/shared/utils/schemas';

/**
 * Owns the command draft and in-flight state so that keystrokes never re-render
 * the (potentially multi-megabyte) transcript rendered by its sibling.
 */
export const ShellInput = memo(function ShellInput() {
  const { commandHistory, addHistoryEntry, addCommand } = useShellStore(
    useShallow((state) => ({
      commandHistory: state.commandHistory,
      addHistoryEntry: state.addHistoryEntry,
      addCommand: state.addCommand,
    })),
  );
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Index into commandHistory for ArrowUp/Down recall — handler-only, not rendered.
  const historyIndexRef = useRef(commandHistory.length);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) {
        return;
      }

      const newIndex = Math.max(0, historyIndexRef.current - 1);
      historyIndexRef.current = newIndex;
      setCommand(commandHistory[newIndex] ?? '');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.length === 0) {
        return;
      }

      const newIndex = Math.min(commandHistory.length, historyIndexRef.current + 1);
      historyIndexRef.current = newIndex;

      if (newIndex === commandHistory.length) {
        setCommand('');
      } else {
        setCommand(commandHistory[newIndex] ?? '');
      }
      return;
    }

    if (e.key !== 'Enter' || isLoading || command.trim() === '') {
      return;
    }

    e.preventDefault();
    const trimmedCommand = command.trim();

    // Validate command prefix before any backend interaction
    const parsed = shellCommandSchema.safeParse(trimmedCommand);
    if (!parsed.success) {
      const errorText = parsed.error.issues[0]?.message ?? 'Unknown error';
      addHistoryEntry({ type: 'command', text: trimmedCommand });
      addHistoryEntry({ type: 'error', text: errorText });
      setCommand('');
      return;
    }

    if (commandHistory[commandHistory.length - 1] !== trimmedCommand) {
      addCommand(trimmedCommand);
    }
    historyIndexRef.current = commandHistory.length + 1;

    setIsLoading(true);
    setCommand('');

    addHistoryEntry({ type: 'command', text: trimmedCommand });

    try {
      debugLog(`Executing shell command: ${trimmedCommand}`);
      const res = await ExecuteCliCommand(trimmedCommand, selectedSerial);
      const text = (res.stdout || res.output || res.stderr || '').trim() || '(No output)';
      if (res.exitCode !== 0 && !res.success && res.stderr) {
        addHistoryEntry({ type: 'error', text: res.stderr.trim() });
      } else {
        addHistoryEntry({ type: 'result', text });
      }
    } catch (err) {
      const error = err as Error;
      handleError('Shell Command', error);
      addHistoryEntry({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Re-focus input after command finishes
  useEffect(() => {
    if (!isLoading) {
      document.getElementById('shell-panel-input')?.focus();
    }
  }, [isLoading]);

  // Sync history index with command history
  useEffect(() => {
    historyIndexRef.current = commandHistory.length;
  }, [commandHistory.length]);

  return (
    <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: 'var(--terminal-border)' }}>
      <InputGroup className="border-0 bg-transparent shadow-none">
        <InputGroupAddon>
          <InputGroupText
            className="select-none font-mono font-semibold text-sm"
            style={{ color: 'var(--terminal-log-info)' }}
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
          style={{ color: 'var(--terminal-fg)' }}
          value={command}
        />
      </InputGroup>
    </div>
  );
});
