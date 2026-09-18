import { describe, expect, it } from "vitest";

import {
  destDirFromDropTarget,
  parseInternalFileNames,
} from "@/features/file-explorer/utils/file-explorer-drop";

describe(parseInternalFileNames, () => {
  it("returns names from the internal drag payload", () => {
    const dataTransfer = {
      getData: () => JSON.stringify(["a.txt", "b"]),
    } as unknown as DataTransfer;
    expect(parseInternalFileNames(dataTransfer)).toStrictEqual(["a.txt", "b"]);
  });

  it("rejects malformed payloads", () => {
    const dataTransfer = {
      getData: () => "{",
    } as unknown as DataTransfer;
    expect(parseInternalFileNames(dataTransfer)).toBeNull();
  });
});

describe(destDirFromDropTarget, () => {
  it("prefers a folder target over the pane fallback", () => {
    const el = document.createElement("div");
    el.dataset.feDropDir = "/sdcard/Download/";
    el.dataset.feDropPane = "/sdcard/";
    expect(destDirFromDropTarget(el, "/fallback/")).toBe("/sdcard/Download/");
  });

  it("uses the pane path when no folder target is set", () => {
    const el = document.createElement("div");
    el.dataset.feDropPane = "/sdcard/DCIM/";
    expect(destDirFromDropTarget(el, "/fallback/")).toBe("/sdcard/DCIM/");
  });
});
