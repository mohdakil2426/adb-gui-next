import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileExplorerStorageGauge } from "@/features/file-explorer/ui/file-explorer-storage-gauge";
import { useDeviceStore } from "@/shared/stores/device-store";

const { getDeviceTelemetryMock } = vi.hoisted(() => ({
  getDeviceTelemetryMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock(import("@/desktop/backend"), () => ({
  GetDeviceTelemetry: (...args: unknown[]) => getDeviceTelemetryMock(...args),
}));

const GIB = 1024 * 1024 * 1024;

describe(FileExplorerStorageGauge, () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
    getDeviceTelemetryMock.mockReset();
  });

  it("renders null when no device is selected", () => {
    const { container } = render(<FileExplorerStorageGauge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders storage gauge when volume telemetry is loaded", async () => {
    useDeviceStore.setState({ selectedSerial: "device-123" });
    getDeviceTelemetryMock.mockResolvedValue({
      storage: [
        {
          freeBytes: 32 * GIB,
          mount: "/data",
          rawMount: "/data",
          totalBytes: 64 * GIB,
          usedBytes: 32 * GIB,
        },
      ],
    });

    render(<FileExplorerStorageGauge currentPath="/sdcard" />);

    await expect(screen.findByText("50%")).resolves.toBeInTheDocument();
    expect(screen.getByText(/32.0 GB free/iu)).toBeInTheDocument();
  });

  it("supports ring variant", async () => {
    useDeviceStore.setState({ selectedSerial: "device-123" });
    getDeviceTelemetryMock.mockResolvedValue({
      storage: [
        {
          freeBytes: 16 * GIB,
          mount: "/data",
          rawMount: "/data",
          totalBytes: 64 * GIB,
          usedBytes: 48 * GIB,
        },
      ],
    });

    render(<FileExplorerStorageGauge currentPath="/data" variant="ring" />);

    await expect(screen.findByText("75%")).resolves.toBeInTheDocument();
  });
});
