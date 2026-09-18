import { beforeEach, describe, expect, it } from "vitest";

import { useShellStore } from "@/shared/stores/shell-store";

describe("shellStore", () => {
  beforeEach(() => {
    useShellStore.setState({
      commandHistory: [],
      history: [],
    });
  });

  describe("addHistoryEntry", () => {
    it("should add a command entry to history", () => {
      useShellStore.getState().addHistoryEntry({
        text: "adb devices",
        type: "command",
      });

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]?.type).toBe("command");
      expect(state.history[0]?.text).toBe("adb devices");
      expect(state.history[0]?.id).toStrictEqual(expect.any(String));
    });

    it("should add a result entry to history", () => {
      useShellStore.getState().addHistoryEntry({
        text: "List of devices attached",
        type: "result",
      });

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]?.type).toBe("result");
      expect(state.history[0]?.id).toStrictEqual(expect.any(String));
    });

    it("should add multiple entries to history", () => {
      useShellStore.getState().addHistoryEntry({ text: "cmd1", type: "command" });
      useShellStore.getState().addHistoryEntry({ text: "result1", type: "result" });
      useShellStore.getState().addHistoryEntry({ text: "cmd2", type: "command" });

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(3);
      const ids = state.history.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(3);
    });

    it("should add an error entry to history", () => {
      useShellStore.getState().addHistoryEntry({
        text: "error message",
        type: "error",
      });

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]?.type).toBe("error");
      expect(state.history[0]?.id).toStrictEqual(expect.any(String));
    });

    it("should preserve a provided id", () => {
      useShellStore.getState().addHistoryEntry({
        id: "fixed-id",
        text: "adb devices",
        type: "command",
      });

      expect(useShellStore.getState().history[0]?.id).toBe("fixed-id");
    });
  });

  describe("setHistory", () => {
    it("should replace entire history", () => {
      useShellStore.getState().addHistoryEntry({ text: "existing", type: "command" });
      useShellStore.getState().setHistory([
        { text: "new1", type: "command" },
        { text: "new2", type: "result" },
      ]);

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(2);
      expect(state.history[0]?.text).toBe("new1");
      expect(state.history[1]?.text).toBe("new2");
    });

    it("should assign unique string ids when replacing history", () => {
      useShellStore.getState().setHistory([
        { text: "new1", type: "command" },
        { text: "new2", type: "result" },
      ]);

      const state = useShellStore.getState();
      expect(state.history[0]?.id).toStrictEqual(expect.any(String));
      expect(state.history[1]?.id).toStrictEqual(expect.any(String));
      expect(state.history[0]?.id).not.toBe(state.history[1]?.id);
    });

    it("should clear history when set to empty array", () => {
      useShellStore.getState().addHistoryEntry({ text: "test", type: "command" });
      useShellStore.getState().setHistory([]);

      expect(useShellStore.getState().history).toHaveLength(0);
    });
  });

  describe("clearHistory", () => {
    it("should clear all history entries", () => {
      useShellStore.getState().addHistoryEntry({ text: "cmd1", type: "command" });
      useShellStore.getState().addHistoryEntry({ text: "result1", type: "result" });
      useShellStore.getState().clearHistory();

      expect(useShellStore.getState().history).toHaveLength(0);
    });
  });

  describe("addCommand", () => {
    it("should add a command to command history", () => {
      useShellStore.getState().addCommand("adb devices");

      const state = useShellStore.getState();
      expect(state.commandHistory).toHaveLength(1);
      expect(state.commandHistory[0]).toBe("adb devices");
    });

    it("should accumulate multiple commands in history", () => {
      useShellStore.getState().addCommand("adb devices");
      useShellStore.getState().addCommand("adb shell");
      useShellStore.getState().addCommand("adb reboot");

      const state = useShellStore.getState();
      expect(state.commandHistory).toHaveLength(3);
      expect(state.commandHistory).toStrictEqual(["adb devices", "adb shell", "adb reboot"]);
    });
  });

  describe("commandHistory integration", () => {
    it("should keep command history separate from display history", () => {
      useShellStore.getState().addHistoryEntry({ text: "display cmd", type: "command" });
      useShellStore.getState().addCommand("actual cmd");

      const state = useShellStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.commandHistory).toHaveLength(1);
      expect(state.history[0]?.text).toBe("display cmd");
      expect(state.commandHistory[0]).toBe("actual cmd");
    });
  });
});
