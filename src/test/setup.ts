import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock @tauri-apps/api/core — IPC is unavailable in jsdom
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock tauri plugin-dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Mock tauri-plugin-log (used by errorHandler → tauri warn/error)
vi.mock('@tauri-apps/plugin-log', () => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));
