import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ViewFlasher } from "@/features/flasher/flasher-view";
import { useDeviceStore } from "@/shared/stores/device-store";

vi.mock(import("@/desktop/backend"), () => ({
  FlashPartition: vi.fn<() => Promise<unknown>>(),
  GetFastbootDevices: vi.fn<() => Promise<unknown>>().mockResolvedValue([]),
  Reboot: vi.fn<() => Promise<unknown>>(),
  RunFastbootHostCommand: vi.fn<() => Promise<unknown>>().mockResolvedValue(""),
  SelectImageFile: vi.fn<() => Promise<unknown>>(),
  SelectZipFile: vi.fn<() => Promise<unknown>>(),
  SetActiveSlot: vi.fn<() => Promise<unknown>>(),
  SideloadPackage: vi.fn<() => Promise<unknown>>(),
  WipeData: vi.fn<() => Promise<unknown>>(),
}));

vi.mock(import("@/desktop/runtime"), () => ({
  OnFileDrop: vi.fn<() => () => void>(() => () => {}),
  OnFileDropOff: vi.fn<() => void>(),
}));

describe(ViewFlasher, () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
  });

  it("renders 4 tab triggers", () => {
    render(<ViewFlasher />);

    expect(screen.getByRole("tab", { name: /overview & diagnostics/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /partition flasher/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /recovery sideload/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /partitions & wipe/iu })).toBeInTheDocument();
  });

  it("renders precision hero banner specs", () => {
    render(<ViewFlasher />);

    expect(screen.getByText("Protocol Mode")).toBeInTheDocument();
    expect(screen.getByText("Bootloader Lock")).toBeInTheDocument();
    expect(screen.getByText("Active Slot")).toBeInTheDocument();
    expect(screen.getByText("Product Board")).toBeInTheDocument();
  });

  it("renders overview tab with partition architecture and diagnostic matrix", () => {
    render(<ViewFlasher initialTab="overview" />);

    expect(screen.getByText("Android A/B Partition Architecture")).toBeInTheDocument();
    expect(screen.getByText("Pre-Flight Diagnostic Matrix")).toBeInTheDocument();
    expect(screen.getByText("Flasher Knowledge Base: Modes & Protocols")).toBeInTheDocument();
    expect(screen.getByText("Recent Flash History & Audit Log")).toBeInTheDocument();
  });

  it("renders partition helper text alongside the explicit field label in partition tab", () => {
    render(<ViewFlasher initialTab="partition" />);

    expect(screen.getByLabelText("Partition Name")).toBeInTheDocument();
    expect(
      screen.getByText("Choose a fastboot partition name or type a custom one.")
    ).toBeInTheDocument();
    expect(screen.getByText("Flash Partition Image")).toBeInTheDocument();
    expect(screen.getByText("Active Boot Slot Switcher")).toBeInTheDocument();
    expect(screen.getByText("Deterministic Multi-Partition Queue")).toBeInTheDocument();
  });

  it("renders sideload tab with drop area and pipeline tracker", () => {
    render(<ViewFlasher initialTab="sideload" />);

    expect(screen.getByText("Recovery Sideload Studio")).toBeInTheDocument();
    expect(screen.getByText("Sideload Pipeline & Execution Tracker")).toBeInTheDocument();
    expect(screen.getByText("Sideload Helper Utilities")).toBeInTheDocument();
  });

  it("renders wipe tab with safety gate and formatted wipe actions", () => {
    render(<ViewFlasher initialTab="wipe" />);

    expect(screen.getByText("Safety Interlock Gate")).toBeInTheDocument();
    expect(screen.getByText("Wipe Userdata (Factory Reset)")).toBeInTheDocument();
    expect(screen.getByText("Erase Cache Partition")).toBeInTheDocument();
    expect(screen.getByText("Erase Metadata Partition")).toBeInTheDocument();
    expect(screen.getByText("Erase System Partition")).toBeInTheDocument();
  });

  it("allows navigating between tabs via tab triggers", async () => {
    const user = userEvent.setup();
    render(<ViewFlasher />);

    expect(screen.getByText("Android A/B Partition Architecture")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /partition flasher/iu }));
    expect(screen.getByLabelText("Partition Name")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /recovery sideload/iu }));
    expect(screen.getByText("Recovery Sideload Studio")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /partitions & wipe/iu }));
    expect(screen.getByText("Safety Interlock Gate")).toBeInTheDocument();
  });
});
