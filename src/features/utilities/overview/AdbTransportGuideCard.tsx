import { HelpCircle, Layers, Terminal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

const ASCII_TRANSPORT_DIAGRAM = `[Host User / Client (ADB GUI Next)]
                │ (IPC / CLI)
                ▼
[Host ADB Server Daemon: 127.0.0.1:5037]
                │
    ┌───────────┴───────────┐
    ▼                       ▼
[USB 3.0 / Bulk Endpoints]  [TCP / IP Network: Port 5555]
    │                       │
    └───────────┬───────────┘
                ▼
[Target Android Device: adbd (Root / Shell daemon)]
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
[Shell/ART] [PackageMgr] [ActivityMgr]`;

const GUIDES = [
  {
    description:
      'ADB works as a tri-part system: Client (this app), Server (host background process on port 5037), and Device Daemon (adbd running inside Android).',
    id: 'architecture',
    label: 'Client / Server Model',
  },
  {
    description:
      'Wireless ADB operates over TCP port 5555. On Android 11+, TLS pairing uses dynamic mDNS ports for secure authentication without requiring initial USB tethering.',
    id: 'wireless',
    label: 'TCP / Wireless Transport',
  },
  {
    description:
      'Android apps and ADB commands execute under the shell user (UID 2000). Root commands execute under superuser (UID 0) via su binaries (Magisk / KernelSU / APatch).',
    id: 'privileges',
    label: 'Shell vs Root Privileges',
  },
];

export function AdbTransportGuideCard() {
  const [activeGuide, setActiveGuide] = useState<string>('architecture');
  const [viewMode, setViewMode] = useState<'visual' | 'ascii'>('visual');

  const selectedGuide = GUIDES.find((g) => g.id === activeGuide) ??
    GUIDES[0] ?? {
      description: '',
      id: 'default',
      label: '',
    };

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 font-semibold text-title">
            <Layers className="size-4.5 text-primary" />
            ADB Transport & Socket Architecture Guide
          </CardTitle>
          <CardDescription className="text-body text-muted-foreground">
            Technical reference for Android Debug Bridge multiplexing, ports, and privilege
            hierarchy
          </CardDescription>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            className={cn('h-7 px-2.5 text-caption', viewMode === 'visual' && 'bg-surface-raised')}
            onClick={() => setViewMode('visual')}
            size="sm"
            type="button"
            variant="outline"
          >
            <Layers className="mr-1 size-3" data-icon="inline-start" />
            Guide
          </Button>
          <Button
            className={cn('h-7 px-2.5 text-caption', viewMode === 'ascii' && 'bg-surface-raised')}
            onClick={() => setViewMode('ascii')}
            size="sm"
            type="button"
            variant="outline"
          >
            <Terminal className="mr-1 size-3" data-icon="inline-start" />
            ASCII Map
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-1">
        {viewMode === 'ascii' ? (
          <div className="overflow-x-auto rounded-lg border border-border/80 bg-background/80 p-3.5">
            <pre className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              {ASCII_TRANSPORT_DIAGRAM}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5 border-border/50 border-b pb-2.5">
              {GUIDES.map((g) => (
                <Button
                  className="h-7 text-caption"
                  key={g.id}
                  onClick={() => setActiveGuide(g.id)}
                  size="sm"
                  type="button"
                  variant={activeGuide === g.id ? 'default' : 'ghost'}
                >
                  {g.label}
                </Button>
              ))}
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-body text-foreground">{selectedGuide.description}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
