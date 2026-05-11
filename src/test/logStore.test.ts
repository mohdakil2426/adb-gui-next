import { beforeEach, describe, expect, it } from "vitest";
import { useLogStore } from "@/lib/logStore";

describe("logStore", () => {
  beforeEach(() => {
    useLogStore.setState({
      logs: [],
      isOpen: false,
      filter: "all",
      searchQuery: "",
      isFollowing: true,
      isPanelMaximized: false,
      activeTab: "logs",
      unreadCount: 0,
      panelHeight: 300,
    });
  });

  describe("addLog", () => {
    it("should add a log entry with auto-generated timestamp", () => {
      useLogStore.getState().addLog("Test message", "info");

      const state = useLogStore.getState();
      expect(state.logs).toHaveLength(1);
      expect(state.logs[0]?.message).toBe("Test message");
      expect(state.logs[0]?.type).toBe("info");
      expect(state.logs[0]?.timestamp).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      expect(state.logs[0]?.id).toBeDefined();
    });

    it("should add error log entry", () => {
      useLogStore.getState().addLog("Error occurred", "error");

      const state = useLogStore.getState();
      expect(state.logs[0]?.type).toBe("error");
      expect(state.logs[0]?.message).toBe("Error occurred");
    });

    it("should add success log entry", () => {
      useLogStore.getState().addLog("Operation successful", "success");

      const state = useLogStore.getState();
      expect(state.logs[0]?.type).toBe("success");
    });

    it("should add warning log entry", () => {
      useLogStore.getState().addLog("Warning message", "warning");

      const state = useLogStore.getState();
      expect(state.logs[0]?.type).toBe("warning");
    });

    it("should increment unreadCount when panel is closed", () => {
      useLogStore.getState().setPanelOpen(false);
      useLogStore.getState().addLog("Test", "info");

      expect(useLogStore.getState().unreadCount).toBe(1);
    });

    it("should not increment unreadCount when panel is open", () => {
      useLogStore.getState().setPanelOpen(true);
      useLogStore.getState().addLog("Test", "info");

      expect(useLogStore.getState().unreadCount).toBe(0);
    });

    it("should keep only MAX_LOGS entries (1000)", () => {
      const store = useLogStore.getState();
      for (let i = 0; i < 1005; i++) {
        store.addLog(`message ${i}`, "info");
      }

      const state = useLogStore.getState();
      expect(state.logs).toHaveLength(1000);
      expect(state.logs[0]?.message).toBe("message 5");
      expect(state.logs[state.logs.length - 1]?.message).toBe("message 1004");
    });

    it("should generate unique IDs for each log", () => {
      useLogStore.getState().addLog("msg1", "info");
      useLogStore.getState().addLog("msg2", "info");

      const state = useLogStore.getState();
      expect(state.logs[0]?.id).not.toBe(state.logs[1]?.id);
    });
  });

  describe("clearLogs", () => {
    it("should clear all logs", () => {
      useLogStore.getState().addLog("msg1", "info");
      useLogStore.getState().addLog("msg2", "error");
      useLogStore.getState().clearLogs();

      const state = useLogStore.getState();
      expect(state.logs).toHaveLength(0);
    });

    it("should reset unreadCount when clearing logs", () => {
      useLogStore.getState().setPanelOpen(false);
      useLogStore.getState().addLog("test", "info");
      useLogStore.getState().clearLogs();

      expect(useLogStore.getState().unreadCount).toBe(0);
    });
  });

  describe("setFilter", () => {
    it("should filter by info level", () => {
      useLogStore.getState().setFilter("info");

      expect(useLogStore.getState().filter).toBe("info");
    });

    it("should filter by error level", () => {
      useLogStore.getState().setFilter("error");

      expect(useLogStore.getState().filter).toBe("error");
    });

    it("should filter by success level", () => {
      useLogStore.getState().setFilter("success");

      expect(useLogStore.getState().filter).toBe("success");
    });

    it("should filter by warning level", () => {
      useLogStore.getState().setFilter("warning");

      expect(useLogStore.getState().filter).toBe("warning");
    });

    it("should set to all", () => {
      useLogStore.getState().setFilter("all");

      expect(useLogStore.getState().filter).toBe("all");
    });
  });

  describe("timestamp generation", () => {
    it("should generate timestamp in HH:MM:SS format", () => {
      useLogStore.getState().addLog("test", "info");

      const timestamp = useLogStore.getState().logs[0]?.timestamp;
      expect(timestamp).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);

      const parts = timestamp?.split(":");
      const hours = Number(parts?.[0]);
      const minutes = Number(parts?.[1]);
      const seconds = Number(parts?.[2]);

      expect(hours).toBeGreaterThanOrEqual(0);
      expect(hours).toBeLessThanOrEqual(23);
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThanOrEqual(59);
      expect(seconds).toBeGreaterThanOrEqual(0);
      expect(seconds).toBeLessThanOrEqual(59);
    });
  });

  describe("panel state", () => {
    it("should toggle panel open/closed", () => {
      useLogStore.getState().togglePanel();

      expect(useLogStore.getState().isOpen).toBe(true);

      useLogStore.getState().togglePanel();

      expect(useLogStore.getState().isOpen).toBe(false);
    });

    it("should reset unreadCount when opening panel", () => {
      useLogStore.getState().setPanelOpen(false);
      useLogStore.getState().addLog("test", "info");
      expect(useLogStore.getState().unreadCount).toBe(1);

      useLogStore.getState().togglePanel();

      expect(useLogStore.getState().unreadCount).toBe(0);
    });

    it("should set panel height", () => {
      useLogStore.getState().setPanelHeight(500);

      expect(useLogStore.getState().panelHeight).toBe(500);
    });

    it("should toggle maximized state", () => {
      useLogStore.getState().toggleMaximized();

      expect(useLogStore.getState().isPanelMaximized).toBe(true);

      useLogStore.getState().toggleMaximized();

      expect(useLogStore.getState().isPanelMaximized).toBe(false);
    });
  });

  describe("searchQuery", () => {
    it("should set search query", () => {
      useLogStore.getState().setSearchQuery("error");

      expect(useLogStore.getState().searchQuery).toBe("error");
    });
  });

  describe("isFollowing", () => {
    it("should toggle isFollowing", () => {
      useLogStore.getState().setIsFollowing(false);

      expect(useLogStore.getState().isFollowing).toBe(false);
    });
  });

  describe("activeTab", () => {
    it("should switch to shell tab", () => {
      useLogStore.getState().setActiveTab("shell");

      expect(useLogStore.getState().activeTab).toBe("shell");
    });

    it("should switch to logs tab", () => {
      useLogStore.getState().setActiveTab("logs");

      expect(useLogStore.getState().activeTab).toBe("logs");
    });
  });

  describe("unreadCount", () => {
    it("should reset unread count", () => {
      useLogStore.getState().setPanelOpen(false);
      useLogStore.getState().addLog("test", "info");
      useLogStore.getState().resetUnreadCount();

      expect(useLogStore.getState().unreadCount).toBe(0);
    });
  });
});
