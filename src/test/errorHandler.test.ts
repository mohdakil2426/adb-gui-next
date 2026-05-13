import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleError, handleInfo, handleSuccess, handleWarning } from '@/shared/utils/errorHandler';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(() => {}),
    success: vi.fn(() => {}),
    warning: vi.fn(() => {}),
  },
}));

const mockAddLog = vi.fn();
vi.mock('@/shared/stores/logStore', () => ({
  useLogStore: {
    getState: () => ({ addLog: mockAddLog }),
  },
}));

describe('handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a formatted message string', () => {
    const msg = handleError('TestCtx', new Error('something broke'));
    expect(msg).toBe('[TestCtx] something broke');
  });

  it('stringifies non-Error values', () => {
    const msg = handleError('TestCtx', 'plain string error');
    expect(msg).toBe('[TestCtx] plain string error');
  });

  it('calls addLog with error level', () => {
    handleError('TestCtx', 'oops');
    expect(mockAddLog).toHaveBeenCalledWith('[TestCtx] oops', 'error');
  });

  it('handles empty error message', () => {
    const msg = handleError('TestCtx', '');
    expect(msg).toBe('[TestCtx] ');
  });

  it('handles numeric error value', () => {
    const msg = handleError('TestCtx', 404);
    expect(msg).toBe('[TestCtx] 404');
  });
});

describe('handleSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls addLog with success level', () => {
    handleSuccess('TestCtx', 'it worked');
    expect(mockAddLog).toHaveBeenCalledWith('[TestCtx] it worked', 'success');
  });

  it('handles empty message', () => {
    handleSuccess('TestCtx', '');
    expect(mockAddLog).toHaveBeenCalledWith('[TestCtx] ', 'success');
  });
});

describe('handleInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls addLog with info level', () => {
    handleInfo('TestCtx', 'fyi');
    expect(mockAddLog).toHaveBeenCalledWith('[TestCtx] fyi', 'info');
  });
});

describe('handleWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls addLog with warning level', () => {
    handleWarning('TestCtx', 'watch out');
    expect(mockAddLog).toHaveBeenCalledWith('[TestCtx] watch out', 'warning');
  });
});
