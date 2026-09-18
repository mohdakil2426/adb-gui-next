import { describe, expect, it } from "vitest";

import { VIEWS } from "@/app/shell/view-config";
import { isTextDeviceFile } from "@/features/file-explorer/utils/text-file-extensions";
import { NAV_SECTIONS, VIEW_META } from "@/shared/commands/navigation";

describe("text device files", () => {
  it("allows known text extensions", () => {
    expect(isTextDeviceFile("init.rc")).toBeTruthy();
    expect(isTextDeviceFile("build.prop")).toBeTruthy();
    expect(isTextDeviceFile("notes.md")).toBeTruthy();
  });

  it("rejects archives and images", () => {
    expect(isTextDeviceFile("boot.img")).toBeFalsy();
    expect(isTextDeviceFile("archive.zip")).toBeFalsy();
    expect(isTextDeviceFile("noext")).toBeFalsy();
  });
});

describe("scrcpy navigation", () => {
  it("registers Scrcpy in Tools and VIEW_META", () => {
    expect(VIEW_META[VIEWS.SCRCPY].title).toBe("Scrcpy");
    const tools = NAV_SECTIONS.find((section) => section.label === "Tools");
    expect(tools?.items).toContain(VIEWS.SCRCPY);
  });
});
