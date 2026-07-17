import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RunAdbHostCommand, RunFastbootHostCommand, RunShellCommand } from '@/desktop/backend';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useShellStore } from '@/shared/stores/shellStore';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/shared/ui/input-group';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { cn } from '@/shared/utils/cn';
import { debugLog } from '@/shared/utils/debug';
import { handleError } from '@/shared/utils/errorHandler';
import { shellCommandSchema } from '@/shared/utils/schemas';

export function ShellPanel() {
  const { history, commandHistory, addHistoryEntry, addCommand } = useShellStore(
    useShallow((state) => ({
      history: state.history,
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
      let result = '';
      if (trimmedCommand.startsWith('adb shell ')) {
        const shellCmd = trimmedCommand.substring(10).trim();
        if (shellCmd) {
          result = await RunShellCommand(shellCmd, selectedSerial);
        } else {
          throw new Error('Usage: adb shell <command...>');
        }
      } else if (trimmedCommand.startsWith('adb ')) {
        const hostCmd = trimmedCommand.substring(4).trim();
        if (hostCmd) {
          result = await RunAdbHostCommand(hostCmd);
        } else {
          throw new Error('Usage: adb <command...>');
        }
      } else if (trimmedCommand.startsWith('fastboot ')) {
        const fastbootCmd = trimmedCommand.substring(9).trim();
        if (fastbootCmd) {
          result = await RunFastbootHostCommand(fastbootCmd, selectedSerial);
        } else {
          throw new Error('Usage: fastboot <command...>');
        }
      } else {
        throw new Error(`Unknown command: "${trimmedCommand}".`);
      }
      addHistoryEntry({ type: 'result', text: result.trim() || '(No output)' });
    } catch (err) {
      const error = err as Error;
      handleError('Shell Command', error);
      addHistoryEntry({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom on history change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [history]);

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
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--terminal-bg)' }}
    >
      <ScrollArea className="min-h-0 w-full flex-1" ref={scrollAreaRef}>
        <div className="p-3">
          <pre
            className="whitespace-pre-wrap break-words font-mono text-[12px] leading-5"
            style={{ color: 'var(--terminal-fg)' }}
          >
            {history.length === 0 ? (
              <span className="italic opacity-40">
                {
                  'Welcome. Type your command below.\nExamples:\n  adb devices\n  adb shell ls /sdcard/\n  fastboot devices'
                }
              </span>
            ) : (
              history.map((entry) => (
                <div className="flex gap-2" key={entry.id}>
                  <span
                    className={cn(
                      'shrink-0 select-none',
                      entry.type === 'command' ? 'font-semibold' : 'opacity-60',
                    )}
                    style={{
                      color:
                        entry.type === 'command'
                          ? 'var(--terminal-log-info)'
                          : 'var(--terminal-fg)',
                    }}
                  >
                    {entry.type === 'command' ? '$' : '>'}
                  </span>
                  <span
                    style={{
                      color:
                        entry.type === 'error' ? 'var(--terminal-log-error)' : 'var(--terminal-fg)',
                    }}
                  >
                    {entry.text}
                  </span>
                </div>
              ))
            )}
          </pre>
        </div>
      </ScrollArea>

      <div
        className="shrink-0 border-t px-3 py-2"
        style={{ borderColor: 'var(--terminal-border)' }}
      >
        <InputGroup className="border-0 bg-transparent shadow-none dark:bg-transparent">
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
    </div>
  );
}
