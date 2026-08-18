import { create } from 'zustand';

export interface MemorySample {
  /** Milliseconds since epoch — the instant the telemetry snapshot resolved. */
  at: number;
  totalBytes: number;
  usedBytes: number;
}

/** ~15 minutes at the dashboard poll interval. Enough to read a trend. */
const MAX_SAMPLES = 60;

/** Stable reference so the selector never returns a fresh array. */
const NO_SAMPLES: MemorySample[] = [];

interface MemoryHistoryState {
  clear: (serial: string) => void;
  pruneDisconnected: (activeSerials: string[]) => void;
  record: (serial: string, sample: MemorySample) => void;
  samplesBySerial: Record<string, MemorySample[]>;
}

/**
 * Session-only RAM history behind the dashboard sparkline.
 *
 * Deliberately **not** persisted: a memory reading from a previous launch is
 * noise, and writing to `localStorage` on every telemetry poll is exactly the
 * pattern the payload progress store was moved away from.
 */
export const useMemoryHistoryStore = create<MemoryHistoryState>()((set) => ({
  samplesBySerial: {},

  record: (serial, sample) => {
    set((state) => {
      const existing = state.samplesBySerial[serial] ?? NO_SAMPLES;
      const latest = existing[existing.length - 1];
      // The same snapshot can re-render; only a newer reading is a new sample.
      if (latest && latest.at >= sample.at) {
        return {};
      }
      return {
        samplesBySerial: {
          ...state.samplesBySerial,
          [serial]: [...existing, sample].slice(-MAX_SAMPLES),
        },
      };
    });
  },

  clear: (serial) => {
    set((state) => {
      if (!(serial in state.samplesBySerial)) {
        return {};
      }
      const next: Record<string, MemorySample[]> = {};
      for (const [key, value] of Object.entries(state.samplesBySerial)) {
        if (key !== serial) {
          next[key] = value;
        }
      }
      return { samplesBySerial: next };
    });
  },

  pruneDisconnected: (activeSerials) => {
    set((state) => {
      const activeSet = new Set(activeSerials);
      let changed = false;
      const next: Record<string, MemorySample[]> = {};
      for (const [key, value] of Object.entries(state.samplesBySerial)) {
        if (activeSet.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? { samplesBySerial: next } : {};
    });
  },
}));

/** Reactive lookup for render bodies. Re-renders only when this device samples. */
export function useMemorySamples(serial: string | null): MemorySample[] {
  return useMemoryHistoryStore((state) =>
    serial ? (state.samplesBySerial[serial] ?? NO_SAMPLES) : NO_SAMPLES,
  );
}
