import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import { usePayloadProgressStore } from '@/features/payload-dumper/model/payloadProgressStore';
import { ViewPayloadDumper } from '@/features/payload-dumper/PayloadDumperView';

vi.mock('@/desktop/backend', () => ({
  CleanupPayloadCache: vi.fn(),
  ComputePartitionFileSha256: vi.fn().mockResolvedValue('mocksha256'),
  CreateCancellationToken: vi.fn(),
  ExtractPayload: vi.fn(),
  GetExtractionPresets: vi.fn().mockResolvedValue([]),
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

  it('renders precision hero banner and 4 tab triggers in empty state', () => {
    render(<ViewPayloadDumper />);
    expect(
      screen.getByRole('heading', { name: 'Payload Dumper', hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^overview$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /source & remote loader/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /extractor & partitions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /extracted outputs & history/i })).toBeInTheDocument();
    expect(screen.getByText('Workflow Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Engine Capabilities')).toBeInTheDocument();
    expect(screen.getByText('3-Step Extraction Workflow')).toBeInTheDocument();
  });
  it('navigates to source tab when clicking source workflow shortcut card', async () => {
    const user = userEvent.setup();
    render(<ViewPayloadDumper />);
    await user.click(screen.getByText('Configure Source'));
    expect(screen.getByText(/Local File Archive/i)).toBeInTheDocument();
  });

  it('renders the loaded state with precision hero banner and extractor controls', async () => {
    const user = userEvent.setup();
    usePayloadDumperStore.setState({
      partitions: [
        { name: 'boot', selected: true, size: 4096 },
        { name: 'system', selected: false, size: 8192 },
      ],
      payloadPath: '/tmp/payload.bin',
      status: 'ready',
    });
    render(<ViewPayloadDumper />);

    // Hero banner displays partition count and payload path
    expect(screen.getAllByText('payload.bin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Standard payload.bin').length).toBeGreaterThan(0);

    // Navigate to Extractor tab
    await user.click(screen.getByRole('tab', { name: /extractor & partitions/i }));
    expect(screen.getByText('Output directory')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^extract 1/i })).toBeInTheDocument();
  });

  it('surfaces a failure that wrote zero files in terminal error state', () => {
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
