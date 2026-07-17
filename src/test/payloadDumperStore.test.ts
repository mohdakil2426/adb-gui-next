import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';

// Reset store state before each test
beforeEach(() => {
  act(() => {
    usePayloadDumperStore.getState().reset();
  });
});

describe('payloadDumperStore', () => {
  it('starts in idle status with empty partitions', () => {
    const { status, partitions } = usePayloadDumperStore.getState();
    expect(status).toBe('idle');
    expect(partitions).toHaveLength(0);
  });

  it('setPartitions replaces the partition list', () => {
    act(() => {
      usePayloadDumperStore.getState().setPartitions([
        { name: 'boot', size: 4096, selected: true },
        { name: 'vendor', size: 8192, selected: false },
      ]);
    });
    expect(usePayloadDumperStore.getState().partitions).toHaveLength(2);
  });

  it('togglePartition flips selected for a single index', () => {
    act(() => {
      usePayloadDumperStore
        .getState()
        .setPartitions([{ name: 'boot', size: 4096, selected: true }]);
    });
    act(() => {
      usePayloadDumperStore.getState().togglePartition(0);
    });
    expect(usePayloadDumperStore.getState().partitions[0]?.selected).toBe(false);
  });

  it('toggleAll selects all partitions', () => {
    act(() => {
      usePayloadDumperStore.getState().setPartitions([
        { name: 'boot', size: 4096, selected: false },
        { name: 'vendor', size: 8192, selected: false },
      ]);
      usePayloadDumperStore.getState().toggleAll(true);
    });
    const { partitions } = usePayloadDumperStore.getState();
    expect(partitions.every((p: { selected: boolean }) => p.selected)).toBe(true);
  });

  it('toggleAll deselects all partitions', () => {
    act(() => {
      usePayloadDumperStore.getState().setPartitions([
        { name: 'boot', size: 4096, selected: true },
        { name: 'vendor', size: 8192, selected: true },
      ]);
      usePayloadDumperStore.getState().toggleAll(false);
    });
    const { partitions } = usePayloadDumperStore.getState();
    expect(partitions.every((p: { selected: boolean }) => !p.selected)).toBe(true);
  });

  it('markPartitionCompleted moves partition from extracting to completed', () => {
    act(() => {
      usePayloadDumperStore
        .getState()
        .setPartitions([{ name: 'boot', size: 4096, selected: true }]);
      usePayloadDumperStore.getState().setExtractingPartitions(new Set(['boot']));
    });
    act(() => {
      usePayloadDumperStore.getState().markPartitionCompleted('boot');
    });
    const { completedPartitions, extractingPartitions, partitions, partitionStatuses } =
      usePayloadDumperStore.getState();
    expect(completedPartitions.has('boot')).toBe(true);
    expect(extractingPartitions.has('boot')).toBe(false);
    expect(partitions[0]?.selected).toBe(false);
    expect(partitionStatuses.get('boot')).toBe('completed');
  });

  it('setExtractingPartitions seeds pending partition statuses', () => {
    act(() => {
      usePayloadDumperStore.getState().setExtractingPartitions(new Set(['boot', 'system']));
    });
    const { partitionStatuses } = usePayloadDumperStore.getState();
    expect(partitionStatuses.get('boot')).toBe('pending');
    expect(partitionStatuses.get('system')).toBe('pending');
  });

  it('updatePartitionProgress maps running then completed status', () => {
    act(() => {
      usePayloadDumperStore.getState().setExtractingPartitions(new Set(['boot']));
      usePayloadDumperStore.getState().updatePartitionProgress('boot', 50, 200, false);
    });
    expect(usePayloadDumperStore.getState().partitionStatuses.get('boot')).toBe('running');

    act(() => {
      usePayloadDumperStore
        .getState()
        .updatePartitionProgress('boot', 200, 200, true, 4096, 4096, 12, 0, 'completed');
    });
    expect(usePayloadDumperStore.getState().partitionStatuses.get('boot')).toBe('completed');
    const progress = usePayloadDumperStore.getState().partitionProgress.get('boot');
    expect(progress?.current).toBe(200);
    expect(progress?.total).toBe(200);
    expect(progress?.percentage).toBe(100);
    expect(progress?.throughputMbps).toBe(12);
  });

  it('updatePartitionProgress computes percentage correctly', () => {
    act(() => {
      usePayloadDumperStore.getState().updatePartitionProgress('boot', 50, 200);
    });
    const progress = usePayloadDumperStore.getState().partitionProgress.get('boot');
    expect(progress?.current).toBe(50);
    expect(progress?.total).toBe(200);
    expect(progress?.percentage).toBe(25);
  });

  it('failActivePartitions marks pending/running as failed', () => {
    act(() => {
      usePayloadDumperStore.getState().setExtractingPartitions(new Set(['boot', 'vendor', 'dtbo']));
      usePayloadDumperStore.getState().updatePartitionProgress('boot', 1, 10, false);
      usePayloadDumperStore.getState().markPartitionCompleted('vendor');
      usePayloadDumperStore.getState().failActivePartitions();
    });
    const statuses = usePayloadDumperStore.getState().partitionStatuses;
    expect(statuses.get('boot')).toBe('failed');
    expect(statuses.get('dtbo')).toBe('failed');
    expect(statuses.get('vendor')).toBe('completed');
    expect(usePayloadDumperStore.getState().extractingPartitions.size).toBe(0);
  });

  it('reset restores initial state', () => {
    act(() => {
      usePayloadDumperStore.getState().setPayloadPath('/some/file.bin');
      usePayloadDumperStore.getState().setStatus('extracting');
      usePayloadDumperStore.getState().reset();
    });
    const { payloadPath, status } = usePayloadDumperStore.getState();
    expect(payloadPath).toBe('');
    expect(status).toBe('idle');
  });

  it('cancelExtraction without token recovers to ready instead of silent no-op', () => {
    act(() => {
      usePayloadDumperStore.getState().setStatus('extracting');
      usePayloadDumperStore.getState().setCancelTokenId(null);
      usePayloadDumperStore.getState().setExtractingPartitions(new Set(['boot']));
      usePayloadDumperStore.getState().cancelExtraction();
    });
    const { status, extractingPartitions } = usePayloadDumperStore.getState();
    expect(status).toBe('ready');
    expect(extractingPartitions.size).toBe(0);
  });

  it('cancelExtraction with token enters cancelling state', () => {
    act(() => {
      usePayloadDumperStore.getState().setStatus('extracting');
      usePayloadDumperStore.getState().setCancelTokenId('7');
      usePayloadDumperStore.getState().cancelExtraction();
    });
    expect(usePayloadDumperStore.getState().status).toBe('cancelling');
  });

  it('beginLoadProgress seeds verifyConnection stage', () => {
    act(() => {
      usePayloadDumperStore.getState().beginLoadProgress();
    });
    const state = usePayloadDumperStore.getState();
    expect(state.loadPhase).toBe('verifyConnection');
    expect(state.loadStep).toBe(1);
    expect(state.loadTotalSteps).toBe(4);
    expect(state.loadStartedAt).toBeTypeOf('number');
    expect(state.loadProgressFromEvent).toBe(false);
  });

  it('setLoadProgress from event locks out optimistic overwrites', () => {
    act(() => {
      usePayloadDumperStore.getState().beginLoadProgress();
      usePayloadDumperStore.getState().setLoadProgress(
        {
          phase: 'locateIndex',
          message: 'Locating ZIP index',
          detail: 'EOCD',
          step: 2,
          totalSteps: 4,
        },
        true,
      );
      usePayloadDumperStore.getState().setOptimisticLoadStep(4);
    });
    const state = usePayloadDumperStore.getState();
    expect(state.loadProgressFromEvent).toBe(true);
    expect(state.loadPhase).toBe('locateIndex');
    expect(state.loadStep).toBe(2);
    expect(state.loadDetail).toBe('EOCD');
  });

  it('clearLoadProgress resets remote load fields', () => {
    act(() => {
      usePayloadDumperStore.getState().beginLoadProgress();
      usePayloadDumperStore.getState().clearLoadProgress();
    });
    const state = usePayloadDumperStore.getState();
    expect(state.loadPhase).toBeNull();
    expect(state.loadStep).toBe(0);
    expect(state.loadStartedAt).toBeNull();
    expect(state.loadMessage).toBe('');
  });
});
