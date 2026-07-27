import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import { usePayloadProgressStore } from '@/features/payload-dumper/model/payloadProgressStore';
import { ViewPayloadDumper } from '@/features/payload-dumper/PayloadDumperView';

vi.mock('@/desktop/backend', () => ({
  CleanupPayloadCache: vi.fn(),
  CreateCancellationToken: vi.fn(),
  ExtractPayload: vi.fn(),
  OpenFolder: vi.fn(),
  SelectOutputDirectory: vi.fn(),
  SelectPayloadFile: vi.fn(),
}));

vi.mock('@/desktop/runtime', () => ({
  EventsOn: () => () => {
    // no-op unlisten
  },
  OnFileDrop: vi.fn(),
  OnFileDropOff: vi.fn(),
}));

describe('ViewPayloadDumper', () => {
  beforeEach(() => {
    usePayloadProgressStore.getState().clearAll();
    usePayloadDumperStore.setState({
      activeMode: 'local',
      errorMessage: '',
      extractedFiles: [],
      extractionStats: null,
      outputDir: '',
      outputPath: '',
      partitions: [],
      payloadPath: '',
      remoteMetadata: null,
      remoteUrl: '',
      status: 'idle',
    });
  });

  it('renders the source state', () => {
    render(<ViewPayloadDumper />);
    expect(screen.getByRole('tab', { name: /local file/i })).toBeInTheDocument();
  });

  it('renders the loaded state with a promoted output directory', () => {
    usePayloadDumperStore.setState({
      partitions: [
        { name: 'boot', selected: true, size: 4096 },
        { name: 'system', selected: false, size: 8192 },
      ],
      payloadPath: '/tmp/payload.bin',
      status: 'ready',
    });
    render(<ViewPayloadDumper />);
    expect(screen.getByText('Output directory')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose…' })).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('surfaces a failure that wrote zero files', () => {
    usePayloadDumperStore.setState({
      errorMessage: 'payload: unexpected EOF',
      extractedFiles: [],
      partitions: [{ name: 'boot', selected: true, size: 4096 }],
      payloadPath: '/tmp/payload.bin',
      status: 'error',
    });
    render(<ViewPayloadDumper />);
    expect(screen.getByText('Extraction failed')).toBeInTheDocument();
    expect(screen.getByText('payload: unexpected EOF')).toBeInTheDocument();
    expect(screen.getByText(/No images were written/)).toBeInTheDocument();
  });
});
