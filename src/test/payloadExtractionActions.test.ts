import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateCancellationToken = vi.fn();
const mockExtractPayload = vi.fn();

vi.mock('@/desktop/backend', () => ({
  CreateCancellationToken: (...args: unknown[]) => mockCreateCancellationToken(...args),
  ExtractPayload: (...args: unknown[]) => mockExtractPayload(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
  },
}));

import { runExtractPayload } from '@/features/payload-dumper/hooks/payloadExtractionActions';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';

describe('runExtractPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePayloadDumperStore.getState().reset();
    mockCreateCancellationToken.mockResolvedValue('token-1');
  });

  function baseDeps() {
    const store = usePayloadDumperStore.getState();
    return {
      addCompletedPartitions: store.addCompletedPartitions,
      clearPartitionProgress: store.clearPartitionProgress,
      completedPartitions: new Set<string>(),
      mode: 'remote' as const,
      outputDir: '',
      outputPath: 'C:\\out',
      partitions: [{ name: 'dtbo', selected: true }],
      payloadPath: 'https://dl.google.com/dl/android/aosp/factory.zip',
      prefetch: false,
      setCancelTokenId: store.setCancelTokenId,
      setErrorMessage: store.setErrorMessage,
      setExtractedFiles: store.setExtractedFiles,
      setExtractingPartitions: store.setExtractingPartitions,
      setExtractionStats: store.setExtractionStats,
      setOutputDir: store.setOutputDir,
      setStatus: store.setStatus,
    };
  }

  it('creates cancel token before extracting and marks success on complete', async () => {
    mockExtractPayload.mockResolvedValue({
      success: true,
      outputDir: 'C:\\out\\factory',
      extractedFiles: ['dtbo.img'],
      error: null,
    });

    await runExtractPayload(baseDeps());

    expect(mockCreateCancellationToken).toHaveBeenCalled();
    expect(mockExtractPayload).toHaveBeenCalled();
    expect(usePayloadDumperStore.getState().status).toBe('success');
    expect(usePayloadDumperStore.getState().completedPartitions.has('dtbo')).toBe(true);
    expect(usePayloadDumperStore.getState().cancelTokenId).toBeNull();
  });

  it('treats cancelled remote extract as non-error and keeps partial files', async () => {
    mockExtractPayload.mockResolvedValue({
      success: false,
      outputDir: 'C:\\out\\factory',
      extractedFiles: ['dtbo.img'],
      error: 'extraction cancelled',
    });

    await runExtractPayload(baseDeps());

    const state = usePayloadDumperStore.getState();
    expect(state.status).toBe('success');
    expect(state.extractedFiles).toContain('dtbo.img');
    expect(state.completedPartitions.has('dtbo')).toBe(true);
    expect(state.errorMessage).toBe('');
    expect(state.cancelTokenId).toBeNull();
  });

  it('returns to ready when cancelled with no partial files', async () => {
    mockExtractPayload.mockResolvedValue({
      success: false,
      outputDir: '',
      extractedFiles: [],
      error: 'extraction cancelled',
    });

    await runExtractPayload(baseDeps());

    expect(usePayloadDumperStore.getState().status).toBe('ready');
    expect(usePayloadDumperStore.getState().errorMessage).toBe('');
  });

  it('does not enter extracting if token creation fails', async () => {
    mockCreateCancellationToken.mockRejectedValue(new Error('token boom'));

    await runExtractPayload(baseDeps());

    expect(mockExtractPayload).not.toHaveBeenCalled();
    expect(usePayloadDumperStore.getState().status).toBe('error');
  });
});
