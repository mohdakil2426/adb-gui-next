import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePayloadProgressStore } from '@/features/payload-dumper/model/payloadProgressStore';

beforeEach(() => {
  act(() => {
    usePayloadProgressStore.getState().clearAll();
  });
});

describe('payloadProgressStore', () => {
  it('is not persisted — nothing is written to localStorage on progress', () => {
    localStorage.clear();
    act(() => {
      usePayloadProgressStore.getState().updatePartitionProgress('boot', 1, 10, false);
      usePayloadProgressStore.getState().updatePartitionProgress('boot', 2, 10, false);
    });
    expect(localStorage.length).toBe(0);
  });

  it('setExtractingPartitions seeds pending partition statuses', () => {
    act(() => {
      usePayloadProgressStore.getState().setExtractingPartitions(new Set(['boot', 'system']));
    });
    const { partitionStatuses } = usePayloadProgressStore.getState();
    expect(partitionStatuses.get('boot')).toBe('pending');
    expect(partitionStatuses.get('system')).toBe('pending');
  });

  it('updatePartitionProgress maps running then completed status', () => {
    act(() => {
      usePayloadProgressStore.getState().setExtractingPartitions(new Set(['boot']));
      usePayloadProgressStore.getState().updatePartitionProgress('boot', 50, 200, false);
    });
    expect(usePayloadProgressStore.getState().partitionStatuses.get('boot')).toBe('running');

    act(() => {
      usePayloadProgressStore
        .getState()
        .updatePartitionProgress('boot', 200, 200, true, 4096, 4096, 12, 0, 'completed');
    });
    expect(usePayloadProgressStore.getState().partitionStatuses.get('boot')).toBe('completed');
    const progress = usePayloadProgressStore.getState().partitionProgress.get('boot');
    expect(progress?.current).toBe(200);
    expect(progress?.total).toBe(200);
    expect(progress?.percentage).toBe(100);
    expect(progress?.throughputMbps).toBe(12);
  });

  it('updatePartitionProgress computes percentage correctly', () => {
    act(() => {
      usePayloadProgressStore.getState().updatePartitionProgress('boot', 50, 200);
    });
    const progress = usePayloadProgressStore.getState().partitionProgress.get('boot');
    expect(progress?.current).toBe(50);
    expect(progress?.total).toBe(200);
    expect(progress?.percentage).toBe(25);
  });

  it('keeps the download pseudo-partition out of the row status map', () => {
    act(() => {
      usePayloadProgressStore.getState().updatePartitionProgress('__download__', 5, 10, false);
    });
    expect(usePayloadProgressStore.getState().partitionProgress.get('__download__')).toBeDefined();
    expect(usePayloadProgressStore.getState().partitionStatuses.has('__download__')).toBe(false);
  });

  it('failActivePartitions marks pending/running as failed', () => {
    act(() => {
      usePayloadProgressStore
        .getState()
        .setExtractingPartitions(new Set(['boot', 'vendor', 'dtbo']));
      usePayloadProgressStore.getState().updatePartitionProgress('boot', 1, 10, false);
      usePayloadProgressStore.getState().markCompleted('vendor');
      usePayloadProgressStore.getState().failActivePartitions();
    });
    const statuses = usePayloadProgressStore.getState().partitionStatuses;
    expect(statuses.get('boot')).toBe('failed');
    expect(statuses.get('dtbo')).toBe('failed');
    expect(statuses.get('vendor')).toBe('completed');
    expect(usePayloadProgressStore.getState().extractingPartitions.size).toBe(0);
  });

  it('clearTransientPartitionStatuses keeps only completed rows', () => {
    act(() => {
      usePayloadProgressStore.getState().setExtractingPartitions(new Set(['boot', 'vendor']));
      usePayloadProgressStore.getState().markCompleted('vendor');
      usePayloadProgressStore.getState().clearTransientPartitionStatuses();
    });
    const statuses = usePayloadProgressStore.getState().partitionStatuses;
    expect(statuses.get('vendor')).toBe('completed');
    expect(statuses.has('boot')).toBe(false);
  });
});
