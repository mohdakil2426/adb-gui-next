import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BottomPanel } from "@/app/shell/BottomPanel/bottom-panel";
import { useLogStore } from "@/shared/stores/log-store";

vi.mock(import("@/shared/ui/sidebar"), () => ({
  useSidebar: () => ({ state: "expanded" }),
}));

vi.mock(import("@/desktop/backend"), () => ({
  SaveLog: vi.fn<() => Promise<void>>(),
}));

vi.mock(import("@tauri-apps/plugin-clipboard-manager"), () => ({
  writeText: vi.fn<(text: string) => Promise<void>>(),
}));

describe(BottomPanel, () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      disconnect = vi.fn<() => void>();
      observe = vi.fn<() => void>();
      unobserve = vi.fn<() => void>();
    } as unknown as typeof ResizeObserver;

    useLogStore.setState({
      activeTab: "logs",
      filter: "all",
      isFollowing: true,
      isOpen: true,
      isPanelMaximized: false,
      logs: [
        {
          id: "1",
          message: "Something happened",
          timestamp: "12:00:00.000",
          type: "info",
        },
      ],
      panelHeight: 300,
      searchQuery: "",
      unreadCount: 0,
    });
  });

  it("opens the log filter menu and applies a level option", async () => {
    const user = userEvent.setup();

    render(<BottomPanel viewportHeight={900} />);

    await user.click(screen.getByLabelText("Filter Logs"));
    await user.click(screen.getByRole("menuitemradio", { name: "Error" }));

    expect(useLogStore.getState().filter).toBe("error");
  });
});
