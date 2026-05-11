import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileSelector } from "@/components/FileSelector";

describe("FileSelector", () => {
  it("shows the full selected path in visible assistive text instead of native title", () => {
    render(
      <FileSelector
        label="Payload File"
        onSelect={() => {}}
        path="/sdcard/Download/payload.bin"
      />
    );

    const fullPath = screen.getByText("/sdcard/Download/payload.bin");
    expect(fullPath).toBeInTheDocument();
    expect(fullPath).not.toHaveAttribute("title");
  });
});
