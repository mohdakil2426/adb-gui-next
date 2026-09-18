import { beforeEach, describe, expect, it, vi } from "vitest";

import { runExtractPayload } from "@/features/payload-dumper/hooks/payload-extraction-actions";
import { usePayloadDumperStore } from "@/features/payload-dumper/model/payload-dumper-store";
import { usePayloadProgressStore } from "@/features/payload-dumper/model/payload-progress-store";

const mockCreateCancellationToken = vi.fn<() => Promise<string>>();
const mockExtractPayload = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock(import("@/desktop/backend"), () => ({
  CreateCancellationToken: (...args: unknown[]) => mockCreateCancellationToken(...args),
  ExtractPayload: (...args: unknown[]) => mockExtractPayload(...args),
}));

vi.mock(import("sonner"), () => ({
  toast: {
    error: vi.fn<() => void>(),
    info: vi.fn<() => void>(),
    loading: vi.fn<() => string>(() => "toast-id"),
    success: vi.fn<() => void>(),
  },
}));

const baseDeps = () => {
  const store = usePayloadDumperStore.getState();
  const progress = usePayloadProgressStore.getState();
  return {
    addCompletedPartitions: store.addCompletedPartitions,
    clearPartitionProgress: progress.clearPartitionProgress,
    clearTransientPartitionStatuses: progress.clearTransientPartitionStatuses,
    completedPartitions: new Set<string>(),
    failActivePartitions: progress.failActivePartitions,
    mode: "remote" as const,
    outputDir: "",
    outputPath: "C:\\out",
    partitions: [{ name: "dtbo", selected: true }],
    payloadPath: "https://dl.google.com/dl/android/aosp/factory.zip",
    prefetch: false,
    setCancelTokenId: store.setCancelTokenId,
    setErrorMessage: store.setErrorMessage,
    setExtractedFiles: store.setExtractedFiles,
    setExtractingPartitions: progress.setExtractingPartitions,
    setExtractionStats: store.setExtractionStats,
    setOutputDir: store.setOutputDir,
    setStatus: store.setStatus,
  };
};
describe(runExtractPayload, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePayloadDumperStore.getState().reset();
    mockCreateCancellationToken.mockResolvedValue("token-1");
  });

  it("creates cancel token before extracting and marks success on complete", async () => {
    mockExtractPayload.mockResolvedValue({
      error: null,
      extractedFiles: ["dtbo.img"],
      outputDir: "C:\\out\\factory",
      success: true,
    });

    await runExtractPayload(baseDeps());

    expect(mockCreateCancellationToken).toHaveBeenCalledWith();
    expect(mockExtractPayload).toHaveBeenCalledWith(
      "https://dl.google.com/dl/android/aosp/factory.zip",
      "C:\\out",
      ["dtbo"],
      false,
      "token-1"
    );
    expect(usePayloadDumperStore.getState().status).toBe("success");
    expect(usePayloadProgressStore.getState().completedPartitions.has("dtbo")).toBeTruthy();
    expect(usePayloadDumperStore.getState().cancelTokenId).toBeNull();
  });

  it("treats cancelled remote extract as non-error and keeps partial files", async () => {
    mockExtractPayload.mockResolvedValue({
      error: "extraction cancelled",
      extractedFiles: ["dtbo.img"],
      outputDir: "C:\\out\\factory",
      success: false,
    });

    await runExtractPayload(baseDeps());

    const state = usePayloadDumperStore.getState();
    expect(state.status).toBe("success");
    expect(state.extractedFiles).toContain("dtbo.img");
    expect(usePayloadProgressStore.getState().completedPartitions.has("dtbo")).toBeTruthy();
    expect(state.errorMessage).toBe("");
    expect(state.cancelTokenId).toBeNull();
  });

  it("returns to ready when cancelled with no partial files", async () => {
    mockExtractPayload.mockResolvedValue({
      error: "extraction cancelled",
      extractedFiles: [],
      outputDir: "",
      success: false,
    });

    await runExtractPayload(baseDeps());

    expect(usePayloadDumperStore.getState().status).toBe("ready");
    expect(usePayloadDumperStore.getState().errorMessage).toBe("");
  });

  it("does not enter extracting if token creation fails", async () => {
    mockCreateCancellationToken.mockRejectedValue(new Error("token boom"));

    await runExtractPayload(baseDeps());

    expect(mockExtractPayload).not.toHaveBeenCalled();
    expect(usePayloadDumperStore.getState().status).toBe("error");
  });
});
