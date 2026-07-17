import { useEffect, useRef } from 'react';
import type { backend } from '@/desktop/models';
import { EventsOn } from '@/desktop/runtime';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';

const OPTIMISTIC_DELAY_MS = 500;
const OPTIMISTIC_STEP_MS = 2500;

/**
 * Subscribes to `payload:load-progress` during remote partition list.
 * Falls back to optimistic stage cycling if no event arrives within 500ms.
 */
export function usePayloadLoadEvents(): void {
  const setLoadProgress = usePayloadDumperStore((state) => state.setLoadProgress);
  const setOptimisticLoadStep = usePayloadDumperStore((state) => state.setOptimisticLoadStep);
  const status = usePayloadDumperStore((state) => state.status);
  const loadProgressFromEvent = usePayloadDumperStore((state) => state.loadProgressFromEvent);
  const loadStartedAt = usePayloadDumperStore((state) => state.loadStartedAt);
  const receivedEventRef = useRef(false);

  useEffect(() => {
    const unlisten = EventsOn('payload:load-progress', (data: backend.PayloadLoadProgress) => {
      if (!data || typeof data !== 'object') {
        return;
      }
      receivedEventRef.current = true;
      setLoadProgress(
        {
          detail: data.detail ?? null,
          message: data.message ?? '',
          phase: data.phase,
          step: data.step ?? 1,
          totalSteps: data.totalSteps ?? 4,
        },
        true,
      );
    });
    return unlisten;
  }, [setLoadProgress]);

  // Optimistic stages when backend has not emitted yet (or never will on older builds).
  useEffect(() => {
    if (status !== 'loading-partitions' || loadStartedAt == null) {
      receivedEventRef.current = false;
      return;
    }

    if (loadProgressFromEvent || receivedEventRef.current) {
      return;
    }

    let stepTimer: number | null = null;
    let optimisticStep = 1;

    const delayTimer = window.setTimeout(() => {
      if (usePayloadDumperStore.getState().loadProgressFromEvent) {
        return;
      }
      setOptimisticLoadStep(1);
      stepTimer = window.setInterval(() => {
        if (usePayloadDumperStore.getState().loadProgressFromEvent) {
          if (stepTimer != null) {
            window.clearInterval(stepTimer);
            stepTimer = null;
          }
          return;
        }
        optimisticStep = Math.min(optimisticStep + 1, 4);
        setOptimisticLoadStep(optimisticStep);
        if (optimisticStep >= 4 && stepTimer != null) {
          window.clearInterval(stepTimer);
          stepTimer = null;
        }
      }, OPTIMISTIC_STEP_MS);
    }, OPTIMISTIC_DELAY_MS);

    return () => {
      window.clearTimeout(delayTimer);
      if (stepTimer != null) {
        window.clearInterval(stepTimer);
      }
    };
  }, [status, loadStartedAt, loadProgressFromEvent, setOptimisticLoadStep]);
}
