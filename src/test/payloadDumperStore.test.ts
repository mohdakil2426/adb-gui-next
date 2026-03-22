import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { usePayloadDumperStore } from '../lib/payloadDumperStore';

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
    expect(usePayloadDumperStore.getState().partitions[0].selected).toBe(false);
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
    expect(partitions.every((p) => p.selected)).toBe(true);
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
    expect(partitions.every((p) => !p.selected)).toBe(true);
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
    const { completedPartitions, extractingPartitions, partitions } =
      usePayloadDumperStore.getState();
    expect(completedPartitions.has('boot')).toBe(true);
    expect(extractingPartitions.has('boot')).toBe(false);
    expect(partitions[0].selected).toBe(false);
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
});
