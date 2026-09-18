import "@testing-library/jest-dom";
import { QueryClient } from "@tanstack/react-query";
import { vi } from "vitest";

// Mock @tauri-apps/api/core — IPC is unavailable in jsdom
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock tauri plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Mock tauri-plugin-log (used by errorHandler → tauri warn/error)
vi.mock("@tauri-apps/plugin-log", () => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  trace: vi.fn(),
  warn: vi.fn(),
}));

// Global mock for useQueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: 0, retry: false },
  },
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => queryClient,
  };
});
