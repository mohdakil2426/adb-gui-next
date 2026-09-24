import { BookOpen, Check, HardDrive, Package, Zap } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

export const FlasherKnowledgeBase = () => (
  <Card className="border-border bg-surface flex h-full flex-col justify-between rounded-xl shadow-none">
    <CardHeader className="pb-3">
      <CardTitle className="text-foreground text-title flex items-center gap-2">
        <BookOpen className="text-muted-foreground size-5" />
        Flasher Knowledge Base: Modes & Protocols
      </CardTitle>
      <CardDescription className="text-caption">
        Understand the exact differences between Fastboot, FastbootD, and ADB Sideload flashing
        mechanisms.
      </CardDescription>
    </CardHeader>

    <CardContent className="flex flex-1 flex-col">
      <Tabs className="flex flex-1 flex-col gap-3" defaultValue="fastboot">
        <TabsList className="bg-surface-raised w-full">
          <TabsTrigger className="text-caption flex-1 gap-1.5" value="fastboot">
            <HardDrive className="size-3.5" />
            Fastboot Mode
          </TabsTrigger>
          <TabsTrigger className="text-caption flex-1 gap-1.5" value="fastbootd">
            <Zap className="text-warning size-3.5" />
            FastbootD Mode
          </TabsTrigger>
          <TabsTrigger className="text-caption flex-1 gap-1.5" value="sideload">
            <Package className="text-info size-3.5" />
            ADB Sideload
          </TabsTrigger>
        </TabsList>

        {/* Fastboot Mode */}
        <TabsContent className="m-0 flex flex-1 flex-col gap-3" value="fastboot">
          <div className="border-border/80 bg-surface-raised/40 flex flex-col gap-2 rounded-lg border p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-body text-foreground font-semibold">
                Bootloader Raw Partition Flasher
              </span>
              <Badge variant="outline">Low-Level Hardware</Badge>
            </div>
            <p className="text-body text-muted-foreground">
              Fastboot runs directly in the device bootloader before the Linux kernel loads. It
              writes raw partition images directly to flash storage partitions.
            </p>
          </div>

          <div className="text-caption grid gap-2 @xs:grid-cols-2">
            <div className="border-border/60 bg-background/50 flex flex-col gap-1.5 rounded-md border p-2.5">
              <span className="text-foreground font-medium">✅ Ideal For</span>
              <ul className="text-muted-foreground flex flex-col gap-1">
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>
                    Flashing Custom Kernels (<code>boot.img</code>)
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>
                    Ramdisk Rooting (<code>init_boot.img</code>)
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>
                    AVB Key Disabling (<code>vbmeta.img</code>)
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>A/B Active Slot switching</span>
                </li>
              </ul>
            </div>

            <div className="border-border/60 bg-background/50 flex flex-col gap-1.5 rounded-md border p-2.5">
              <span className="text-foreground font-medium">⚠️ Limitations</span>
              <ul className="text-muted-foreground flex flex-col gap-1">
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
          <div className="border-border/80 bg-surface-raised/40 flex flex-col gap-2 rounded-lg border p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-body text-foreground font-semibold">
                Userspace Fastboot (Android 10+ Dynamic Partitions)
              </span>
              <Badge variant="warning">Recovery Userspace</Badge>
            </div>
            <p className="text-body text-muted-foreground">
              FastbootD is a userspace daemon running inside the Recovery environment. It interacts
              with the device-mapper (DM) kernel layer to dynamically resize, create, and flash
              logical partitions.
            </p>
          </div>

          <div className="text-caption grid gap-2 @xs:grid-cols-2">
            <div className="border-border/60 bg-background/50 flex flex-col gap-1.5 rounded-md border p-2.5">
              <span className="text-foreground font-medium">✅ Ideal For</span>
              <ul className="text-muted-foreground flex flex-col gap-1">
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>
                    Generic System Images (<code>system.img</code> GSI)
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>
                    Vendor & Product Overlays (<code>vendor.img</code>)
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>Dynamic Partition Resizing & Erasing</span>
                </li>
              </ul>
            </div>

            <div className="border-border/60 bg-background/50 flex flex-col gap-1.5 rounded-md border p-2.5">
              <span className="text-foreground font-medium">💡 How to Access</span>
              <p className="text-muted-foreground">
                Run <code>fastboot reboot fastboot</code> while in bootloader, or choose &quot;Enter
                Fastboot&quot; from Recovery menu.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* ADB Sideload Mode */}
        <TabsContent className="m-0 flex flex-1 flex-col gap-3" value="sideload">
          <div className="border-border/80 bg-surface-raised/40 flex flex-col gap-2 rounded-lg border p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-body text-foreground font-semibold">
                Recovery OTA & ROM Installer Engine
              </span>
              <Badge variant="info">Encrypted OTA Pipeline</Badge>
            </div>
            <p className="text-body text-muted-foreground">
              ADB Sideload streams flashable update packages (.zip) to the recovery updater binary.
              It handles signature validation, delta patching, and automatic A/B slot swapping
              seamlessly.
            </p>
          </div>

          <div className="text-caption grid gap-2 @xs:grid-cols-2">
            <div className="border-border/60 bg-background/50 flex flex-col gap-1.5 rounded-md border p-2.5">
              <span className="text-foreground font-medium">✅ Ideal For</span>
              <ul className="text-muted-foreground flex flex-col gap-1">
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>Full Custom ROMs (LineageOS, PixelOS)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>Official Manufacturer OTA Update ZIPs</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="text-success size-3 shrink-0" />
                  <span>Magisk / KernelSU recovery install packages</span>
                </li>
              </ul>
            </div>

            <div className="border-border/60 bg-background/50 flex flex-col gap-1.5 rounded-md border p-2.5">
              <span className="text-foreground font-medium">💡 How to Access</span>
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
