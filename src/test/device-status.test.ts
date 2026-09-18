import { describe, expect, it } from "vitest";

import { getStatusConfig } from "@/shared/utils/device-status";

describe("deviceStatus", () => {
  it("returns semantic token classes for known device states", () => {
    expect(getStatusConfig("device")).toMatchObject({
      badgeClass: expect.stringContaining("bg-success-light"),
      label: "adb",
      variant: "default",
    });
    expect(getStatusConfig("unauthorized")).toMatchObject({
      badgeClass: expect.stringContaining("text-"),
      label: "unauthorized",
      variant: "destructive",
    });
  });
});
