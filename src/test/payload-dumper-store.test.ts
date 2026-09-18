import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { usePayloadDumperStore } from "@/features/payload-dumper/model/payload-dumper-store";
import { usePayloadProgressStore } from "@/features/payload-dumper/model/payload-progress-store";

describe("payloadDumperStore", () => {
  // Reset store state before each test — `reset()` also clears the progress store.
  beforeEach(() => {
    act(() => {
      usePayloadDumperStore.getState().reset();
    });
  });

  it("starts in idle status with empty partitions", () => {
    const { status, partitions } = usePayloadDumperStore.getState();
    expect(status).toBe("idle");
    expect(partitions).toHaveLength(0);
  });

  it("setPartitions replaces the partition list", () => {
    act(() => {
      usePayloadDumperStore.getState().setPartitions([
        { name: "boot", selected: true, size: 4096 },
        { name: "vendor", selected: false, size: 8192 },
      ]);
    });
    expect(usePayloadDumperStore.getState().partitions).toHaveLength(2);
  });

  it("togglePartition flips selected for a single index", () => {
    act(() => {
      usePayloadDumperStore
        .getState()
        .setPartitions([{ name: "boot", selected: true, size: 4096 }]);
    });
    act(() => {
      usePayloadDumperStore.getState().togglePartition(0);
    });
    expect(usePayloadDumperStore.getState().partitions[0]?.selected).toBeFalsy();
  });

  it("toggleAll selects all partitions", () => {
    act(() => {
      usePayloadDumperStore.getState().setPartitions([
        { name: "boot", selected: false, size: 4096 },
        { name: "vendor", selected: false, size: 8192 },
      ]);
      usePayloadDumperStore.getState().toggleAll(true);
    });
    const { partitions } = usePayloadDumperStore.getState();
    expect(partitions.every((p: { selected: boolean }) => p.selected)).toBeTruthy();
  });

  it("toggleAll deselects all partitions", () => {
    act(() => {
      usePayloadDumperStore.getState().setPartitions([
        { name: "boot", selected: true, size: 4096 },
        { name: "vendor", selected: true, size: 8192 },
      ]);
      usePayloadDumperStore.getState().toggleAll(false);
    });
    const { partitions } = usePayloadDumperStore.getState();
    expect(partitions.every((p: { selected: boolean }) => !p.selected)).toBeTruthy();
  });

  it("markPartitionCompleted moves partition from extracting to completed", () => {
    act(() => {
      usePayloadDumperStore
        .getState()
        .setPartitions([{ name: "boot", selected: true, size: 4096 }]);
      usePayloadProgressStore.getState().setExtractingPartitions(new Set(["boot"]));
    });
    act(() => {
      usePayloadDumperStore.getState().markPartitionCompleted("boot");
    });
    const { completedPartitions, extractingPartitions, partitionStatuses } =
      usePayloadProgressStore.getState();
    expect(completedPartitions.has("boot")).toBeTruthy();
    expect(extractingPartitions.has("boot")).toBeFalsy();
    expect(usePayloadDumperStore.getState().partitions[0]?.selected).toBeFalsy();
    expect(partitionStatuses.get("boot")).toBe("completed");
  });

  it("reset restores initial state", () => {
    act(() => {
      usePayloadDumperStore.getState().setPayloadPath("/some/file.bin");
      usePayloadDumperStore.getState().setStatus("extracting");
      usePayloadDumperStore.getState().reset();
    });
    const { payloadPath, status } = usePayloadDumperStore.getState();
    expect(payloadPath).toBe("");
    expect(status).toBe("idle");
  });

  it("cancelExtraction without token recovers to ready instead of silent no-op", () => {
    act(() => {
      usePayloadDumperStore.getState().setStatus("extracting");
      usePayloadDumperStore.getState().setCancelTokenId(null);
      usePayloadProgressStore.getState().setExtractingPartitions(new Set(["boot"]));
      usePayloadDumperStore.getState().cancelExtraction();
    });
    expect(usePayloadDumperStore.getState().status).toBe("ready");
    expect(usePayloadProgressStore.getState().extractingPartitions.size).toBe(0);
  });

  it("cancelExtraction with token enters cancelling state", () => {
    act(() => {
      usePayloadDumperStore.getState().setStatus("extracting");
      usePayloadDumperStore.getState().setCancelTokenId("7");
      usePayloadDumperStore.getState().cancelExtraction();
    });
    expect(usePayloadDumperStore.getState().status).toBe("cancelling");
  });

  it("beginLoadProgress seeds verifyConnection stage", () => {
    act(() => {
      usePayloadDumperStore.getState().beginLoadProgress();
    });
    const state = usePayloadDumperStore.getState();
    expect(state.loadPhase).toBe("verifyConnection");
    expect(state.loadStep).toBe(1);
    expect(state.loadTotalSteps).toBe(4);
    expect(state.loadStartedAt).toBeTypeOf("number");
    expect(state.loadProgressFromEvent).toBeFalsy();
  });

  it("setLoadProgress from event locks out optimistic overwrites", () => {
    act(() => {
      usePayloadDumperStore.getState().beginLoadProgress();
      usePayloadDumperStore.getState().setLoadProgress(
        {
          detail: "EOCD",
          message: "Locating ZIP index",
          phase: "locateIndex",
          step: 2,
          totalSteps: 4,
        },
        true
      );
      usePayloadDumperStore.getState().setOptimisticLoadStep(4);
    });
    const state = usePayloadDumperStore.getState();
    expect(state.loadProgressFromEvent).toBeTruthy();
    expect(state.loadPhase).toBe("locateIndex");
    expect(state.loadStep).toBe(2);
    expect(state.loadDetail).toBe("EOCD");
  });

  it("clearLoadProgress resets remote load fields", () => {
    act(() => {
      usePayloadDumperStore.getState().beginLoadProgress();
      usePayloadDumperStore.getState().clearLoadProgress();
    });
    const state = usePayloadDumperStore.getState();
    expect(state.loadPhase).toBeNull();
    expect(state.loadStep).toBe(0);
    expect(state.loadStartedAt).toBeNull();
    expect(state.loadMessage).toBe("");
  });
});
