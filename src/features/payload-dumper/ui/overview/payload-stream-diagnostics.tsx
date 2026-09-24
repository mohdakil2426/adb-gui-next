import { Cpu, Database, Network, Radio, Zap } from "lucide-react";

import { Card, CardContent } from "@/shared/ui/card";

const STREAM_STEPS = [
  {
    badge: "Step 1",
    description:
      "Issues HTTP HEAD & 1-byte Range request to verify remote server partial content support.",
    icon: Network,
    title: "HTTP Range Probing",
  },
  {
    badge: "Step 2",
    description:
      "Fetches the trailing 64 KB of the remote ZIP to locate the End of Central Directory (EOCD).",
    icon: Database,
    title: "Tail Directory Scan",
  },
  {
    badge: "Step 3",
    description: "Extracts the CrAU magic header and Protobuf manifest without reading data blobs.",
    icon: Radio,
    title: "Manifest Extraction",
  },
  {
    badge: "Step 4",
    description:
      "Only downloads byte extents required for your chosen partitions, saving gigabytes of bandwidth.",
    icon: Zap,
    title: "Selective Extent Pull",
  },
];

export const PayloadStreamDiagnostics = () => (
  <Card className="border-border bg-surface flex flex-col rounded-lg p-4 shadow-none">
    <div className="pb-2">
      <h3 className="text-foreground text-title flex items-center gap-2 font-semibold">
        <Cpu className="text-primary size-4" /> Partial Range Stream Engine Mechanics
      </h3>
      <p className="text-caption text-muted-foreground">
        How OTA payload dumper extracts single partitions from 5GB remote files in seconds
      </p>
    </div>

    <CardContent className="grid grid-cols-1 gap-3 p-0 pt-2 @sm:grid-cols-2 @lg:grid-cols-4">
      {STREAM_STEPS.map((step) => {
        const Icon = step.icon;
        return (
          <div
            className="border-border/60 bg-surface-raised/30 flex flex-col gap-2 rounded-lg border p-3"
            key={step.title}
          >
            <div className="flex items-center justify-between">
              <div className="border-border bg-surface text-primary flex size-7 items-center justify-center rounded-md border">
                <Icon className="size-3.5" />
              </div>
              <span className="text-muted-foreground font-mono text-[10px] uppercase">
                {step.badge}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-body text-foreground font-medium">{step.title}</span>
              <p className="text-caption text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </CardContent>
  </Card>
);
