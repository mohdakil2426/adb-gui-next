import { ShieldCheck, Workflow } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';

export function MarketplaceGuideCard() {
  return (
    <Card className="gap-0 rounded-lg border-border bg-surface py-0 shadow-none">
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-muted-foreground" />
            <h3 className="font-semibold text-body text-foreground">
              Verified Pipeline & Security Architecture
            </h3>
          </div>
          <Badge
            className="gap-1 border-success/30 bg-success/10 font-mono text-caption text-success"
            variant="outline"
          >
            <ShieldCheck className="size-3" />
            ZERO TAMPERING GUARANTEE
          </Badge>
        </div>

        <p className="text-body text-muted-foreground">
          Every application listed in the catalog is indexed directly from upstream open-source
          releases or verified package repositories without repackaging or intermediate proxies.
        </p>

        {/* ASCII Flowchart Diagram */}
        <div className="overflow-x-auto rounded-lg border border-border/80 bg-surface-raised/70 p-3 font-mono text-mono-sm">
          <pre className="select-text text-muted-foreground leading-relaxed">
            {`+-----------------------------------------------------------------------------------------------+
|                            PRECISION APK SIDELOADING PIPELINE                                 |
+-----------------------------------------------------------------------------------------------+

 [ Upstream Sources ]             [ Local Rust Host Engine ]           [ Target Android Device ]
  +------------------+             +-----------------------+            +---------------------+
  | GitHub Releases  | ==(HTTPS)==>| 1. Download Stream    |            |                     |
  | F-Droid Index    |             |    Chunk Buffer       |            |                     |
  | IzzyOnDroid Repo |             +-----------+-----------+            |                     |
  +------------------+                         |                        |                     |
                                               v                        |                     |
                                   +-----------------------+            |                     |
                                   | 2. Integrity & Hash   |            |                     |
                                   |    SHA-256 Checksum   |            |                     |
                                   +-----------+-----------+            |                     |
                                               |                        |                     |
                                               v                        |                     |
                                   +-----------------------+            |                     |
                                   | 3. APK Manifest Parse |            |                     |
                                   |    ABI / SDK Match    |            |                     |
                                   +-----------+-----------+            |                     |
                                               |                        |                     |
                                               v                        |                     |
                                   +-----------------------+            |                     |
                                   | 4. ADB Socket Pipe    | ==(Socket)=> 5. Package Manager |
                                   |    'adb install -r'   |            |    'pm install'     |
                                   +-----------------------+            |    v2/v3 Signature  |
                                                                        +---------------------+`}
          </pre>
        </div>

        {/* 4 Pipeline Step Cards */}
        <div className="grid @xl:grid-cols-4 @xs:grid-cols-2 grid-cols-1 gap-2.5">
          <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface-raised/40 p-2.5">
            <div className="flex items-center gap-1.5 font-medium text-caption text-foreground">
              <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 font-bold text-[10px] text-primary">
                1
              </span>
              Direct Upstream Source
            </div>
            <p className="text-caption text-muted-foreground">
              Downloads binary release assets straight from upstream GitHub release tags and F-Droid
              package repositories.
            </p>
          </div>

          <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface-raised/40 p-2.5">
            <div className="flex items-center gap-1.5 font-medium text-caption text-foreground">
              <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 font-bold text-[10px] text-primary">
                2
              </span>
              Cryptographic Checksum
            </div>
            <p className="text-caption text-muted-foreground">
              Computes local SHA-256 digests on downloaded artifacts to match official upstream
              repository manifests.
            </p>
          </div>

          <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface-raised/40 p-2.5">
            <div className="flex items-center gap-1.5 font-medium text-caption text-foreground">
              <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 font-bold text-[10px] text-primary">
                3
              </span>
              Hardware Architecture Match
            </div>
            <p className="text-caption text-muted-foreground">
              Extracts APK native library ABIs (<code className="text-mono-sm">arm64-v8a</code>,{' '}
              <code className="text-mono-sm">x86_64</code>) and target SDK minimums.
            </p>
          </div>

          <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface-raised/40 p-2.5">
            <div className="flex items-center gap-1.5 font-medium text-caption text-foreground">
              <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 font-bold text-[10px] text-primary">
                4
              </span>
              Zero-Privilege Sideload
            </div>
            <p className="text-caption text-muted-foreground">
              Installs via standard ADB protocol over encrypted USB or Wi-Fi channel with full
              downgrade and replace safeguards.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
