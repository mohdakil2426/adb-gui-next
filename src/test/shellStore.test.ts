import { beforeEach, describe, expect, it } from 'vitest';
import { useShellStore } from '@/lib/shellStore';

describe('shellStore', () => {
  beforeEach(() => {
    useShellStore.setState({
      history: [],
      commandHistory: [],
    });
  });

  describe('addHistoryEntry', () => {
    it('should add a command entry to history', () => {
      useShellStore.getState().addHistoryEntry({
        type: 'command',
        text: 'adb devices',
      });

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]?.type).toBe('command');
      expect(state.history[0]?.text).toBe('adb devices');
    });

    it('should add a result entry to history', () => {
      useShellStore.getState().addHistoryEntry({
        type: 'result',
        text: 'List of devices attached',
      });

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]?.type).toBe('result');
    });

    it('should add multiple entries to history', () => {
      useShellStore.getState().addHistoryEntry({ type: 'command', text: 'cmd1' });
      useShellStore.getState().addHistoryEntry({ type: 'result', text: 'result1' });
      useShellStore.getState().addHistoryEntry({ type: 'command', text: 'cmd2' });

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(3);
    });

    it('should add an error entry to history', () => {
      useShellStore.getState().addHistoryEntry({
        type: 'error',
        text: 'error message',
      });

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]?.type).toBe('error');
    });
  });

  describe('setHistory', () => {
    it('should replace entire history', () => {
      useShellStore.getState().addHistoryEntry({ type: 'command', text: 'existing' });
      useShellStore.getState().setHistory([
        { type: 'command', text: 'new1' },
        { type: 'result', text: 'new2' },
      ]);

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(2);
      expect(state.history[0]?.text).toBe('new1');
      expect(state.history[1]?.text).toBe('new2');
    });

    it('should clear history when set to empty array', () => {
      useShellStore.getState().addHistoryEntry({ type: 'command', text: 'test' });
      useShellStore.getState().setHistory([]);

      expect(useShellStore.getState().history).toHaveLength(0);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history entries', () => {
      useShellStore.getState().addHistoryEntry({ type: 'command', text: 'cmd1' });
      useShellStore.getState().addHistoryEntry({ type: 'result', text: 'result1' });
      useShellStore.getState().clearHistory();

      expect(useShellStore.getState().history).toHaveLength(0);
    });
  });

  describe('addCommand', () => {
    it('should add a command to command history', () => {
      useShellStore.getState().addCommand('adb devices');

      const state = useShellStore.getState();
      expect(state.commandHistory).toHaveLength(1);
      expect(state.commandHistory[0]).toBe('adb devices');
    });

    it('should accumulate multiple commands in history', () => {
      useShellStore.getState().addCommand('adb devices');
      useShellStore.getState().addCommand('adb shell');
      useShellStore.getState().addCommand('adb reboot');

      const state = useShellStore.getState();
      expect(state.commandHistory).toHaveLength(3);
      expect(state.commandHistory).toEqual(['adb devices', 'adb shell', 'adb reboot']);
    });
  });

  describe('commandHistory integration', () => {
    it('should keep command history separate from display history', () => {
      useShellStore.getState().addHistoryEntry({ type: 'command', text: 'display cmd' });
      useShellStore.getState().addCommand('actual cmd');

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.commandHistory).toHaveLength(1);
      expect(state.history[0]?.text).toBe('display cmd');
      expect(state.commandHistory[0]).toBe('actual cmd');
    });
  });
});
