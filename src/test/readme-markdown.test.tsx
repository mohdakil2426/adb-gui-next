import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BrowserOpenURL } from "@/desktop/runtime";
import { ReadmeMarkdown } from "@/features/marketplace/ui/app-detail/readme-markdown";

vi.mock(import("@/desktop/runtime"), () => ({
  BrowserOpenURL: vi.fn<(url: string) => Promise<unknown>>(),
}));
describe(ReadmeMarkdown, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders headings and paragraphs correctly", () => {
    const md = "# Title\n\n## Subtitle\n\nParagraph text here.";
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByRole("heading", { level: 2, name: /title/iu })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /subtitle/iu })).toBeInTheDocument();
    expect(screen.getByText("Paragraph text here.")).toBeInTheDocument();
  });

  it("renders markdown images and links with proper attributes", () => {
    const md =
      "![App Icon](https://raw.githubusercontent.com/owner/repo/main/logo.png)\n\n[Website](https://example.com)";
    render(<ReadmeMarkdown markdown={md} />);

    const img = screen.getByRole("img", { name: /app icon/iu });
    expect(img).toHaveAttribute(
      "src",
      "https://raw.githubusercontent.com/owner/repo/main/logo.png"
    );

    const link = screen.getByRole("link", { name: /website/iu });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders GFM pipe tables with headers", () => {
    const md =
      "| Feature | Status |\n|---|---|\n| Root Support | Active |\n| Audio Convolver | Enabled |";
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText("Feature")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders GFM pipe tables with row content", () => {
    const md =
      "| Feature | Status |\n|---|---|\n| Root Support | Active |\n| Audio Convolver | Enabled |";
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText("Root Support")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Audio Convolver")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("renders fenced code blocks with language banner", () => {
    const md = "```bash\nadb install app.apk\n```";
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText(/bash/iu)).toBeInTheDocument();
    expect(screen.getByText("adb install app.apk")).toBeInTheDocument();
  });

  it("renders task list items with checked and unchecked states", () => {
    const md = "- [x] Completed task\n- [ ] Pending task";
    render(<ReadmeMarkdown markdown={md} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(screen.getByText("Completed task")).toBeInTheDocument();
    expect(screen.getByText("Pending task")).toBeInTheDocument();
  });

  it("renders blockquotes and inline styles", () => {
    const md = "> Important note here with **bold** and `code` and ~~strikethrough~~";
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText(/Important note here/iu)).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();
    expect(screen.getByText("strikethrough")).toBeInTheDocument();
  });

  it("renders GitHub alerts with title and custom icons", () => {
    const md = "> [!NOTE]\n> This is a helpful note\n\n> [!WARNING]\n> High risk warning";
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("This is a helpful note")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("High risk warning")).toBeInTheDocument();
  });

  it("renders keyboard, superscript, and subscript tags", () => {
    const md = "Press <kbd>Ctrl+F</kbd> for search. x<sup>2</sup> and H<sub>2</sub>O";
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText("Ctrl+F")).toBeInTheDocument();
    expect(screen.getAllByText("2")).toHaveLength(2);
  });

  it("renders centered HTML blocks with linked badges and decodes HTML entities", () => {
    const md = `<p align="center">
<a href="https://example.com/docs"><img src="https://img.shields.io/badge/Status-Active-2563EB?style=flat&amp;logo=app" alt="App Status"></a>
<a href="https://example.com/cn"><img src="https://img.shields.io/badge/Lang-CN-E85D75" alt="Chinese"></a>
</p>`;
    render(<ReadmeMarkdown markdown={md} />);

    const statusBadge = screen.getByRole("img", { name: /app status/iu });
    expect(statusBadge).toHaveAttribute(
      "src",
      "https://img.shields.io/badge/Status-Active-2563EB?style=flat&logo=app"
    );

    const cnBadge = screen.getByRole("img", { name: /chinese/iu });
    expect(cnBadge).toHaveAttribute("src", "https://img.shields.io/badge/Lang-CN-E85D75");

    const docLink = screen.getByRole("link", { name: /app status/iu });
    expect(docLink).toHaveAttribute("href", "https://example.com/docs");
  });

  it("renders centered HTML headings and HTML images with dimensions", () => {
    const md = `<p align="center">
<img src="https://raw.githubusercontent.com/org/repo/main/logo.png" width="96" alt="Haoleme Logo">
</p>
<h1 align="center">Haoleme</h1>`;
    render(<ReadmeMarkdown markdown={md} />);

    const logo = screen.getByRole("img", { name: /haoleme logo/iu });
    expect(logo).toHaveAttribute("src", "https://raw.githubusercontent.com/org/repo/main/logo.png");
    expect(logo).toHaveAttribute("width", "96");

    const heading = screen.getByRole("heading", {
      level: 2,
      name: /haoleme/iu,
    });
    expect(heading).toHaveClass("text-center");
  });

  it("renders interactive details and summary accordion disclosure", () => {
    const md = `<details>
<summary>Advanced Options</summary>
Detailed configuration information here.
</details>`;
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText("Advanced Options")).toBeInTheDocument();
    expect(screen.getByText("Detailed configuration information here.")).toBeInTheDocument();
  });

  it("renders ordered numbered lists with first items", () => {
    const md = "1. Download the tool\n2. Connect via USB\n3. Execute payload";
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("Download the tool")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
    expect(screen.getByText("Connect via USB")).toBeInTheDocument();
  });

  it("renders ordered numbered lists with trailing item", () => {
    const md = "1. Download the tool\n2. Connect via USB\n3. Execute payload";
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText("3.")).toBeInTheDocument();
    expect(screen.getByText("Execute payload")).toBeInTheDocument();
  });

  it("intercepts external link clicks and calls BrowserOpenURL", () => {
    const md = "[Website](https://example.com)";
    render(<ReadmeMarkdown markdown={md} />);

    const link = screen.getByRole("link", { name: /website/iu });
    fireEvent.click(link);

    expect(BrowserOpenURL).toHaveBeenCalledWith("https://example.com");
  });

  it("renders pre-rendered comrak html when supplied and intercepts links", () => {
    const html =
      '<h2>Rendered by Comrak</h2><p>Description text</p><a href="https://example.org">External Documentation</a>';
    render(<ReadmeMarkdown html={html} markdown="" />);

    expect(
      screen.getByRole("heading", { level: 2, name: /rendered by comrak/iu })
    ).toBeInTheDocument();
    expect(screen.getByText("Description text")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /external documentation/iu });
    fireEvent.click(link);
    expect(BrowserOpenURL).toHaveBeenCalledWith("https://example.org");
  });

  it("copies code to clipboard when clicking pre element", () => {
    const writeTextMock = vi.fn<(text: string) => Promise<void>>();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const html = "<pre><code>adb shell pm list packages</code></pre>";
    render(<ReadmeMarkdown html={html} markdown="" />);

    const pre = screen.getByText("adb shell pm list packages");
    fireEvent.click(pre);

    expect(writeTextMock).toHaveBeenCalledWith("adb shell pm list packages");
  });
});
