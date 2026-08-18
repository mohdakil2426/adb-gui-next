import { BookOpen, Check, HardDrive, Package, Zap } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export function FlasherKnowledgeBase() {
  return (
    <Card className="flex h-full flex-col justify-between rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-foreground text-title">
          <BookOpen className="size-5 text-muted-foreground" />
          Flasher Knowledge Base: Modes & Protocols
        </CardTitle>
        <CardDescription className="text-caption">
          Understand the exact differences between Fastboot, FastbootD, and ADB Sideload flashing
          mechanisms.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <Tabs className="flex flex-1 flex-col gap-3" defaultValue="fastboot">
          <TabsList className="grid w-full grid-cols-3 bg-surface-raised">
            <TabsTrigger className="gap-1.5 text-caption" value="fastboot">
              <HardDrive className="size-3.5" />
              Fastboot Mode
            </TabsTrigger>
            <TabsTrigger className="gap-1.5 text-caption" value="fastbootd">
              <Zap className="size-3.5 text-warning" />
              FastbootD Mode
            </TabsTrigger>
            <TabsTrigger className="gap-1.5 text-caption" value="sideload">
              <Package className="size-3.5 text-info" />
              ADB Sideload
            </TabsTrigger>
          </TabsList>

          {/* Fastboot Mode */}
          <TabsContent className="m-0 flex flex-1 flex-col gap-3" value="fastboot">
            <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-body text-foreground">
                  Bootloader Raw Partition Flasher
                </span>
                <Badge variant="outline">Low-Level Hardware</Badge>
              </div>
              <p className="text-body text-muted-foreground">
                Fastboot runs directly in the device bootloader before the Linux kernel loads. It
                writes raw partition images directly to flash storage partitions.
              </p>
            </div>

            <div className="grid @xs:grid-cols-2 gap-2 text-caption">
              <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-background/50 p-2.5">
                <span className="font-medium text-foreground">✅ Ideal For</span>
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>
                      Flashing Custom Kernels (<code>boot.img</code>)
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>
                      Ramdisk Rooting (<code>init_boot.img</code>)
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>
                      AVB Key Disabling (<code>vbmeta.img</code>)
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>A/B Active Slot switching</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-background/50 p-2.5">
                <span className="font-medium text-foreground">⚠️ Limitations</span>
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  <li>
                    • Cannot resize dynamic partitions inside <code>super</code>
                  </li>
                  <li>• Cannot flash logical partitions on Android 10+ without FastbootD</li>
                  <li>• Requires an unlocked OEM bootloader</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* FastbootD Mode */}
          <TabsContent className="m-0 flex flex-1 flex-col gap-3" value="fastbootd">
            <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-body text-foreground">
                  Userspace Fastboot (Android 10+ Dynamic Partitions)
                </span>
                <Badge variant="warning">Recovery Userspace</Badge>
              </div>
              <p className="text-body text-muted-foreground">
                FastbootD is a userspace daemon running inside the Recovery environment. It
                interacts with the device-mapper (DM) kernel layer to dynamically resize, create,
                and flash logical partitions.
              </p>
            </div>

            <div className="grid @xs:grid-cols-2 gap-2 text-caption">
              <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-background/50 p-2.5">
                <span className="font-medium text-foreground">✅ Ideal For</span>
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>
                      Generic System Images (<code>system.img</code> GSI)
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>
                      Vendor & Product Overlays (<code>vendor.img</code>)
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>Dynamic Partition Resizing & Erasing</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-background/50 p-2.5">
                <span className="font-medium text-foreground">💡 How to Access</span>
                <p className="text-muted-foreground">
                  Run <code>fastboot reboot fastboot</code> while in bootloader, or choose
                  &quot;Enter Fastboot&quot; from Recovery menu.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ADB Sideload Mode */}
          <TabsContent className="m-0 flex flex-1 flex-col gap-3" value="sideload">
            <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-body text-foreground">
                  Recovery OTA & ROM Installer Engine
                </span>
                <Badge variant="info">Encrypted OTA Pipeline</Badge>
              </div>
              <p className="text-body text-muted-foreground">
                ADB Sideload streams flashable update packages (.zip) to the recovery updater
                binary. It handles signature validation, delta patching, and automatic A/B slot
                swapping seamlessly.
              </p>
            </div>

            <div className="grid @xs:grid-cols-2 gap-2 text-caption">
              <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-background/50 p-2.5">
                <span className="font-medium text-foreground">✅ Ideal For</span>
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>Full Custom ROMs (LineageOS, PixelOS)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>Official Manufacturer OTA Update ZIPs</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    <span>Magisk / KernelSU recovery install packages</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-background/50 p-2.5">
                <span className="font-medium text-foreground">💡 How to Access</span>
                <p className="text-muted-foreground">
                  Boot to recovery, tap &quot;Apply update&quot; → &quot;Apply from ADB&quot;, then
                  send the ZIP package.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
