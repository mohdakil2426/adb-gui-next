import { describe, expect, it, test } from "vitest";
import {
  formatBytes,
  formatBytesNum,
  formatCompactNumber,
  formatDisplayDate,
  formatFileSize,
  formatRating,
  getFileName,
} from "@/lib/utils";

describe("formatting helpers", () => {
  test("formats marketplace display values consistently", () => {
    expect(formatFileSize(1_572_864)).toBe("1.5 MB");
    expect(formatCompactNumber(12_500)).toBe("12.5K");
    expect(formatRating(4.26)).toBe("4.3");
    expect(formatDisplayDate("2026-04-24T00:00:00.000Z")).toMatch(/\b2026\b/);
  });
});

describe("getFileName", () => {
  it("should extract filename from POSIX path", () => {
    expect(getFileName("/sdcard/Download/app.apk")).toBe("app.apk");
  });

  it("should extract filename from Windows path", () => {
    expect(getFileName("C:\\Users\\test\\app.apk")).toBe("app.apk");
  });

  it("should handle empty string", () => {
    expect(getFileName("")).toBe("");
  });

  it("should handle path with no segments", () => {
    expect(getFileName(" ")).toBe(" ");
  });

  it("should handle file in current directory", () => {
    expect(getFileName("app.apk")).toBe("app.apk");
  });

  it("should handle nested paths", () => {
    expect(getFileName("/very/long/nested/path/file.txt")).toBe("file.txt");
  });
});

describe("formatBytes", () => {
  it("should format bytes correctly", () => {
    expect(formatBytes("512")).toBe("512 B");
  });

  it("should format kilobytes correctly", () => {
    expect(formatBytes("2048")).toBe("2.0 KB");
  });

  it("should format megabytes correctly", () => {
    expect(formatBytes("5242880")).toBe("5.0 MB");
  });

  it("should format gigabytes correctly", () => {
    expect(formatBytes("2147483648")).toBe("2.0 GB");
  });

  it("should handle zero", () => {
    expect(formatBytes("0")).toBe("0 B");
  });

  it("should handle empty string", () => {
    expect(formatBytes("")).toBe("");
  });

  it("should handle NaN", () => {
    expect(formatBytes("abc")).toBe("abc");
  });

  it("should handle very small values", () => {
    expect(formatBytes("1")).toBe("1 B");
  });
});

describe("formatBytesNum", () => {
  it("should format zero bytes", () => {
    expect(formatBytesNum(0)).toBe("0 B");
  });

  it("should format bytes correctly", () => {
    expect(formatBytesNum(512)).toBe("512 B");
  });

  it("should format kilobytes correctly", () => {
    expect(formatBytesNum(2048)).toBe("2 KB");
  });

  it("should format megabytes correctly", () => {
    expect(formatBytesNum(5_242_880)).toBe("5 MB");
  });

  it("should format gigabytes correctly", () => {
    expect(formatBytesNum(2_147_483_648)).toBe("2 GB");
  });

  it("should format terabytes correctly", () => {
    expect(formatBytesNum(1_099_511_627_776)).toBe("1 TB");
  });

  it("should handle decimal values", () => {
    expect(formatBytesNum(1536)).toBe("1.5 KB");
  });
});
