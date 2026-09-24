import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PayloadPartitionChart } from "@/features/payload-dumper/ui/payload-partition-chart";

const MIB = 1024 * 1024;

describe(PayloadPartitionChart, () => {
  it("renders null when partitions list is empty or all zero-sized", () => {
    const { container: emptyContainer } = render(<PayloadPartitionChart partitions={[]} />);
    expect(emptyContainer.firstChild).toBeNull();

    const { container: zeroContainer } = render(
      <PayloadPartitionChart partitions={[{ name: "empty", size: 0 }]} />
    );
    expect(zeroContainer.firstChild).toBeNull();
  });

  it("renders partition allocation breakdown with top partitions", () => {
    render(
      <PayloadPartitionChart
        partitions={[
          { name: "system", size: 2048 * MIB },
          { name: "vendor", size: 1024 * MIB },
          { name: "product", size: 1536 * MIB },
          { name: "boot", size: 64 * MIB },
        ]}
      />
    );

    expect(screen.getByText("Partition Allocation")).toBeInTheDocument();
    expect(screen.getByText("4 partitions")).toBeInTheDocument();
    expect(screen.getAllByText("system").length).toBeGreaterThan(0);
    expect(screen.getAllByText("boot").length).toBeGreaterThan(0);
  });

  it("switches between bar view and ring view when toggle buttons are clicked", () => {
    render(
      <PayloadPartitionChart
        partitions={[
          { name: "system", size: 2048 * MIB },
          { name: "vendor", size: 1024 * MIB },
          { name: "boot", size: 64 * MIB },
        ]}
      />
    );

    const ringButton = screen.getByRole("button", { name: "Ring chart view" });
    const barButton = screen.getByRole("button", { name: "Bar chart view" });

    expect(barButton).toHaveAttribute("aria-pressed", "true");
    expect(ringButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(ringButton);

    expect(ringButton).toHaveAttribute("aria-pressed", "true");
    expect(barButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Total")).toBeInTheDocument();
  });
});
