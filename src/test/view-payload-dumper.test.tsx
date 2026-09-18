import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePayloadDumperStore } from "@/features/payload-dumper/model/payload-dumper-store";
import { payloadDumperInitialState } from "@/features/payload-dumper/model/payload-dumper-store-defaults";
import { usePayloadProgressStore } from "@/features/payload-dumper/model/payload-progress-store";
import { ViewPayloadDumper } from "@/features/payload-dumper/payload-dumper-view";

const { mockCatalogDevices } = vi.hoisted(() => ({
  mockCatalogDevices: [
    {
      brand: "google",
      builds: [
        {
          androidVersion: "Android 15",
          buildId: "AP4A.250105.002",
          downloadUrl: "https://ota.googlezip.net/husky-ota-ap4a.250105.002.zip",
          fileSize: 2_500_000_000,
          id: "husky_ap4a_250105_002",
          imageType: "ota",
          isLatest: true,
          releaseDate: "January 2025",
          securityPatch: "2025-01-05",
          sha256: "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e",
          version: "Android 15 (AP4A.250105.002)",
        },
      ],
      codename: "husky",
      id: "google_pixel_8_pro",
      name: "Google Pixel 8 Pro",
      releaseYear: 2023,
      series: "Pixel 8",
      soc: "Google Tensor G3",
    },
    {
      brand: "nothing",
      builds: [
        {
          androidVersion: "Android 16",
          buildId: "Pong-B4.1-260618-1026",
          downloadUrl:
            "https://android.googleapis.com/packages/ota-api/package/821762bba7df49d1648ab91eef5c98574f20e740.zip",
          id: "pong_b4_1",
          imageType: "ota",
          isLatest: true,
          releaseDate: "2026-06-18",
          version: "Nothing OS 4.1",
        },
      ],
      codename: "pong",
      id: "nothing_phone_2",
      name: "Nothing Phone (2)",
      releaseYear: 2023,
      series: "Phone (2)",
      soc: "Qualcomm Snapdragon 8+ Gen 1",
    },
    {
      brand: "xiaomi",
      builds: [
        {
          androidVersion: "Android 14",
          buildId: "OS1.0.18.0.UNCMIXM",
          downloadUrl:
            "https://bigota.d.miui.com/OS1.0.18.0.UNCMIXM/houji_global-ota_full-OS1.0.18.0.UNCMIXM-user-14.0-53296c0d4a.zip",
          id: "xiaomi_houji_ota",
          imageType: "ota",
          isLatest: true,
          releaseDate: "2024-11-20",
          version: "HyperOS 1.0.18.0.UNCMIXM",
        },
      ],
      codename: "houji",
      id: "xiaomi_14",
      name: "Xiaomi 14",
      releaseYear: 2023,
      series: "Xiaomi 14 Series",
      soc: "Qualcomm Snapdragon 8 Gen 3",
    },
    {
      brand: "oneplus",
      builds: [
        {
          androidVersion: "Android 16",
          buildId: "CPH2749_16.0.2.401(EX01)",
          downloadUrl:
            "https://archive.org/download/oneplus_archive/spike0en/infiniti/CPH2749_16.0.2.401.zip",
          id: "oneplus_infiniti_cph2749",
          imageType: "ota",
          isLatest: true,
          releaseDate: "2025-01-20",
          version: "OxygenOS 16.0.2.401",
        },
      ],
      codename: "infiniti",
      id: "oneplus_13",
      name: "OnePlus 13",
      releaseYear: 2024,
      series: "OnePlus Flagship Series",
      soc: "Qualcomm Snapdragon 8 Elite",
    },
    {
      brand: "samsung",
      builds: [
        {
          androidVersion: "Android 16",
          buildId: "S928BXXS6DZG1 (EUX)",
          downloadUrl: "https://samfw.com/firmware/SM-S928B/EUX/S928BXXS6DZG1",
          id: "samsung_s928b_eux",
          imageType: "factory",
          isLatest: true,
          releaseDate: "2026-07-20",
          version: "S928BXXS6DZG1",
        },
      ],
      codename: "SM-S928B",
      id: "samsung_s24_ultra",
      name: "Galaxy S24 Ultra",
      releaseYear: 2024,
      series: "Galaxy S Series",
      soc: "Qualcomm Snapdragon 8 Gen 3 for Galaxy",
    },
  ],
}));

vi.mock(import("@/desktop/backend"), () => ({
  CleanupPayloadCache: vi.fn<() => Promise<unknown>>(),
  ComputePartitionFileSha256: vi.fn<() => Promise<string>>().mockResolvedValue("mocksha256"),
  CreateCancellationToken: vi.fn<() => Promise<string>>(),
  ExtractPayload: vi.fn<() => Promise<unknown>>(),
  GetExtractionPresets: vi.fn<() => Promise<unknown>>().mockResolvedValue([]),
  GetFirmwareCatalog: vi
    .fn<(brand?: string) => Promise<unknown>>()
    .mockImplementation((brand?: string) => {
      if (!brand) {
        return Promise.resolve(mockCatalogDevices);
      }
      return Promise.resolve(mockCatalogDevices.filter((d) => d.brand === brand));
    }),
  GetSupportedFirmwareBrands: vi
    .fn<() => Promise<string[]>>()
    .mockResolvedValue(["google", "nothing", "xiaomi", "oneplus", "samsung"]),
  OpenFolder: vi.fn<() => Promise<unknown>>(),
  RefreshFirmwareCatalog: vi.fn<() => Promise<unknown>>().mockResolvedValue(mockCatalogDevices),
  SelectOutputDirectory: vi.fn<() => Promise<unknown>>(),
  SelectPayloadFile: vi.fn<() => Promise<unknown>>(),
}));

vi.mock(import("@/desktop/runtime"), () => ({
  EventsOn: () => () => {
    // no-op unlisten
  },
  OnFileDrop: vi.fn<() => () => void>(),
  OnFileDropOff: vi.fn<() => void>(),
}));

const renderWithClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ViewPayloadDumper />
    </QueryClientProvider>
  );
};

describe(ViewPayloadDumper, () => {
  beforeEach(() => {
    usePayloadProgressStore.getState().clearAll();
    usePayloadDumperStore.setState({
      ...payloadDumperInitialState,
    });
  });

  it("renders 4 tab triggers in empty state", () => {
    renderWithClient();
    expect(
      screen.getByRole("heading", { hidden: true, name: "Payload Dumper" })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^overview$/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /firmware hub/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /extractor/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /extracted outputs & history/iu })).toBeInTheDocument();
  });

  it("renders workflow shortcut cards in empty state", () => {
    renderWithClient();
    expect(screen.getByText("Workflow Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Engine Capabilities")).toBeInTheDocument();
    expect(screen.getByText("3-Step Extraction Workflow")).toBeInTheDocument();
  });

  it("navigates to extractor tab when clicking extractor workflow shortcut card", async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByText("Open Extractor"));
    expect(screen.getByText(/Local File Archive/iu)).toBeInTheDocument();
    expect(screen.getByText(/Remote OTA URL Stream/iu)).toBeInTheDocument();
  });
  it("navigates to firmware hub and opens device detail", async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole("tab", { name: /firmware hub/iu }));
    expect(screen.getByText("Firmware Hub & Device Marketplace")).toBeInTheDocument();
    await user.click(await screen.findByText("Google Pixel 8 Pro"));
    expect(screen.getAllByText("husky").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AP4A.250105.002/u).length).toBeGreaterThan(0);
  });
  it("filters Nothing devices in firmware hub and opens device detail", async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole("tab", { name: /firmware hub/iu }));
    await user.click(screen.getByRole("button", { name: /nothing/iu }));
    expect(screen.getByText("Nothing Phone (2)")).toBeInTheDocument();
    await user.click(screen.getByText("Nothing Phone (2)"));
    expect(screen.getAllByText("pong").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pong-B4.1-260618-1026/u).length).toBeGreaterThan(0);
  });

  it("filters Xiaomi devices in firmware hub and opens device detail", async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole("tab", { name: /firmware hub/iu }));
    await user.click(screen.getByRole("button", { name: /xiaomi/iu }));
    expect(screen.getByText("Xiaomi 14")).toBeInTheDocument();
    await user.click(screen.getByText("Xiaomi 14"));
    expect(screen.getAllByText("houji").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/OS1.0.18.0.UNCMIXM/u).length).toBeGreaterThan(0);
  });
  it("filters OnePlus devices in firmware hub and opens device detail", async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole("tab", { name: /firmware hub/iu }));
    await user.click(screen.getByRole("button", { name: /oneplus/iu }));
    const oneplusCard = await screen.findByText("OnePlus 13");
    await user.click(oneplusCard);
    expect(screen.getAllByText("infiniti").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CPH2749_16.0.2.401/u).length).toBeGreaterThan(0);
  });

  it("filters Samsung devices in firmware hub and opens device detail", async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole("tab", { name: /firmware hub/iu }));
    await user.click(screen.getByRole("button", { name: /samsung/iu }));
    const samsungCard = await screen.findByText("Galaxy S24 Ultra");
    await user.click(samsungCard);
    expect(screen.getAllByText("SM-S928B").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/S928BXXS6DZG1/u).length).toBeGreaterThan(0);
  });
  it("renders the loaded state with precision hero banner and extractor controls", async () => {
    const user = userEvent.setup();
    usePayloadDumperStore.setState({
      outputPath: "C:/fake/output",
      partitions: [
        { name: "boot", selected: true, size: 67_108_864 },
        { name: "init_boot", selected: false, size: 8_388_608 },
        { name: "vendor_boot", selected: false, size: 67_108_864 },
      ],
    });

    renderWithClient();
    await user.click(screen.getByRole("tab", { name: /extractor/iu }));
    await expect(screen.findByText("boot.img")).resolves.toBeInTheDocument();
    await expect(screen.findByText("init_boot.img")).resolves.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /extract 1 · 64.0 MB/iu })).toBeInTheDocument();
    expect(screen.getByText(/Local File Archive/iu)).toBeInTheDocument();
    expect(screen.getByText(/Remote OTA URL Stream/iu)).toBeInTheDocument();
  });

  it("surfaces a failure that wrote zero files in terminal error state", () => {
    usePayloadDumperStore.setState({
      errorMessage: "Archive header is corrupted",
      partitions: [{ name: "boot", selected: false, size: 67_108_864 }],
      status: "error",
    });

    renderWithClient();
    expect(screen.getByText("Extraction failed")).toBeInTheDocument();
    expect(screen.getByText("Archive header is corrupted")).toBeInTheDocument();
    expect(screen.getByText(/No images were written/iu)).toBeInTheDocument();
  });
});
