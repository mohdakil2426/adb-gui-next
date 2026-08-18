import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Package,
  ShieldCheck,
  Snowflake,
  Terminal,
  Unlock,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface KnowledgeTopic {
  badge: string;
  commandSnippet?: string;
  content: string[];
  icon: LucideIcon;
  id: string;
  title: string;
}

const TOPICS: KnowledgeTopic[] = [
  {
    id: 'virtualization',
    title: 'Virtualization & Hypervisors (HAXM vs WHPX vs KVM)',
    icon: Zap,
    badge: 'Hardware Acceleration',
    commandSnippet: 'emulator -avd <avd_name> -accel on',
    content: [
      'Android Studio Emulator uses hardware-assisted virtualization to run x86_64 and arm64 guest kernels at near-native CPU execution speeds.',
      'On Windows 10/11, WHPX (Windows Hypervisor Platform) is the modern standard, allowing co-existence with WSL2, Hyper-V, and Docker Desktop without requiring legacy Intel HAXM.',
      'On Linux, KVM (Kernel-based Virtual Machine) provides direct kernel passthrough, while macOS utilizes the Apple Hypervisor.framework.',
    ],
  },
  {
    id: 'root-architecture',
    title: 'Root Architecture: Magisk vs KernelSU vs SuperSU',
    icon: ShieldCheck,
    badge: 'Root Mechanics',
    commandSnippet: 'adb shell su -c id -u',
    content: [
      'Modern Android (API 29+) enforces dm-verity and immutable system partitions. Traditional SuperSU binary modifications to /system/xbin/su cause bootloops on modern images.',
      'Magisk implements "systemless root" by injecting magiskinit into ramdisk.img / boot.img. It constructs an overlayfs over /system and starts the su daemon at early init before Android zygote boots.',
      'KernelSU hooks directly into the Linux kernel syscall table (execve/faccessat) on GKI devices. For emulators, Magisk ramdisk injection remains the most reliable cross-API approach.',
    ],
  },
  {
    id: 'ramdisk-patching',
    title: 'RAMDisk Patching Pipeline & magiskboot Engine',
    icon: Package,
    badge: 'Automated Pipeline',
    commandSnippet: 'magiskboot unpack ramdisk.img && magiskboot repack',
    content: [
      'The automated rooting pipeline extracts the AVD ramdisk image (system-images/android-XX/.../ramdisk.img) and copies it to a temporary staging workspace.',
      'magiskboot decompresses the CPIO archive, analyzes the init binary, and replaces the entrypoint with magiskinit while backing up the original init.',
      'The repacked ramdisk is written to the AVD folder or system images directory, allowing Magisk to gain root privileges on the subsequent kernel boot.',
    ],
  },
  {
    id: 'cold-boot',
    title: 'Cold Boot Requirements (-no-snapshot-load)',
    icon: Snowflake,
    badge: 'Snapshot Invariant',
    commandSnippet: 'emulator -avd <name> -no-snapshot-load -no-snapshot-save',
    content: [
      'Quick Boot saves the entire VM memory state (RAM + CPU registers) to snapshots.img when the emulator window is closed.',
      'If an emulator is patched with Magisk and then started with Quick Boot, the emulator will reload the previous RAM state from snapshot, completely bypassing the patched ramdisk on disk.',
      'To ensure root persists, always perform a Cold Boot (-no-snapshot-load) after modifying ramdisk or system partitions.',
    ],
  },
  {
    id: 'writable-system',
    title: 'Writable System (-writable-system) & SELinux Constraints',
    icon: Unlock,
    badge: 'Filesystem Mounts',
    commandSnippet: 'emulator -avd <name> -writable-system -selinux permissive',
    content: [
      'By default, Android system images are mounted read-only (EROFS / ext4 read-only) with dm-verity verification enabled.',
      'Passing -writable-system instructs QEMU to create a qcow2 overlay layer over system.img and vendor.img, enabling "adb remount" to write files directly to /system.',
      'For advanced root tools and deep debugging, running with SELinux in permissive mode allows unrestricted system calls without security denial crashes.',
    ],
  },
];

export function EmulatorKnowledgeBase() {
  const [expandedId, setExpandedId] = useState<string>('virtualization');

  return (
    <Card className="@container flex flex-col rounded-xl border-border bg-surface py-4 shadow-none">
      <CardHeader className="gap-0 px-4.5 pb-2">
        <CardTitle
          as="h2"
          className="flex items-center gap-2 font-medium text-caption text-muted-foreground uppercase tracking-wider"
        >
          <BookOpen aria-hidden="true" className="size-3.5 text-muted-foreground" />
          Virtualization & Rooting Knowledge Base
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-4.5 pt-1">
        {TOPICS.map((topic) => {
          const isExpanded = expandedId === topic.id;
          const Icon = topic.icon;

          return (
            <div
              className={cn(
                'flex flex-col rounded-lg border transition-colors',
                isExpanded
                  ? 'border-border bg-surface-raised/70'
                  : 'border-border/40 bg-surface-raised/20 hover:bg-surface-raised/40',
              )}
              key={topic.id}
            >
              {/* Header Accordion Trigger */}
              <button
                aria-expanded={isExpanded}
                className="flex items-center justify-between gap-3 p-3.5 text-left"
                onClick={() => {
                  setExpandedId(isExpanded ? '' : topic.id);
                }}
                type="button"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                      isExpanded
                        ? 'border-border bg-surface text-foreground'
                        : 'border-border/60 bg-surface-raised text-muted-foreground',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-body text-foreground">{topic.title}</span>
                      <span className="rounded-md border border-border/60 bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {topic.badge}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-muted-foreground">
                  {isExpanded ? (
                    <ChevronUp aria-hidden="true" className="size-4" />
                  ) : (
                    <ChevronDown aria-hidden="true" className="size-4" />
                  )}
                </div>
              </button>

              {/* Accordion Content Body */}
              {isExpanded ? (
                <div className="flex flex-col gap-3 border-border/40 border-t p-3.5 pt-3">
                  <div className="flex flex-col gap-1.5 text-body text-muted-foreground">
                    {topic.content.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  {topic.commandSnippet ? (
                    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface p-2.5">
                      <Terminal
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <code className="font-mono text-foreground text-mono-sm">
                        {topic.commandSnippet}
                      </code>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
