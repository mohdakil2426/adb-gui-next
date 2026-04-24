import React, { useState, useRef, useEffect } from 'react';
import { handleError } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import { shellCommandSchema } from '@/lib/schemas';
import { useShellStore } from '@/lib/shellStore';
import { RunShellCommand, RunAdbHostCommand, RunFastbootHostCommand } from '@/lib/desktop/backend';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

export function ShellPanel() {
  const history = useShellStore((state) => state.history);
  const commandHistory = useShellStore((state) => state.commandHistory);
  const setHistory = useShellStore((state) => state.setHistory);
  const addCommand = useShellStore((state) => state.addCommand);
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(commandHistory.length);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      const newIndex = Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setCommand(commandHistory[newIndex] || '');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      const newIndex = Math.min(commandHistory.length, historyIndex + 1);
      setHistoryIndex(newIndex);

      if (newIndex === commandHistory.length) {
        setCommand('');
      } else {
        setCommand(commandHistory[newIndex]);
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
      const errorText = parsed.error.issues[0].message;
      setHistory([
        ...history,
        { type: 'command', text: trimmedCommand },
        { type: 'error', text: errorText },
      ]);
      setCommand('');
      return;
    }

    if (commandHistory[commandHistory.length - 1] !== trimmedCommand) {
      addCommand(trimmedCommand);
    }
    setHistoryIndex(commandHistory.length + 1);

    setIsLoading(true);
    setCommand('');

    const newHistory = [...history, { type: 'command' as const, text: trimmedCommand }];
    setHistory(newHistory);

    try {
      debugLog(`Executing shell command: ${trimmedCommand}`);
      let result = '';
      if (trimmedCommand.startsWith('adb shell ')) {
        const shellCmd = trimmedCommand.substring(10).trim();
        if (shellCmd) result = await RunShellCommand(shellCmd);
        else throw new Error('Usage: adb shell <command...>');
      } else if (trimmedCommand.startsWith('adb ')) {
        const hostCmd = trimmedCommand.substring(4).trim();
        if (hostCmd) result = await RunAdbHostCommand(hostCmd);
        else throw new Error('Usage: adb <command...>');
      } else if (trimmedCommand.startsWith('fastboot ')) {
        const fastbootCmd = trimmedCommand.substring(9).trim();
        if (fastbootCmd) result = await RunFastbootHostCommand(fastbootCmd);
        else throw new Error('Usage: fastboot <command...>');
      } else {
        throw new Error(`Unknown command: "${trimmedCommand}".`);
      }
      setHistory([...newHistory, { type: 'result', text: result.trim() || '(No output)' }]);
    } catch (err) {
      const error = err as Error;
      handleError('Shell Command', error);
      setHistory([...newHistory, { type: 'error', text: error.message }]);
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
    setHistoryIndex(commandHistory.length);
  }, [commandHistory.length]);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: 'var(--terminal-bg)' }}
    >
      <ScrollArea className="flex-1 min-h-0 w-full" ref={scrollAreaRef}>
        <div className="p-3">
          <pre
            className="text-[12px] font-mono whitespace-pre-wrap break-words leading-5"
            style={{ color: 'var(--terminal-fg)' }}
          >
            {history.length === 0 ? (
              <span className="opacity-40 italic">
                {
                  'Welcome. Type your command below.\nExamples:\n  adb devices\n  adb shell ls /sdcard/\n  fastboot devices'
                }
              </span>
            ) : (
              history.map((entry, index) => (
                <div key={index} className="flex gap-2">
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
        className="px-3 py-2 border-t shrink-0"
        style={{ borderColor: 'var(--terminal-border)' }}
      >
        <InputGroup className="border-0 bg-transparent shadow-none dark:bg-transparent">
          <InputGroupAddon>
            <InputGroupText
              className="font-mono text-sm font-semibold select-none"
              style={{ color: 'var(--terminal-log-info)' }}
            >
              $
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="shell-panel-input"
            aria-label="Shell Command"
            name="shell-command"
            autoComplete="off"
            spellCheck={false}
            placeholder="adb devices, adb shell ls, fastboot devices…"
            className="font-mono text-[12px]"
            style={{ color: 'var(--terminal-fg)' }}
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              setHistoryIndex(commandHistory.length);
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoFocus
          />
        </InputGroup>
      </div>
    </div>
  );
}
