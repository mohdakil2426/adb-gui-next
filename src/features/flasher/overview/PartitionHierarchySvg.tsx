import type { ActiveSlot } from '@/features/flasher/model/flasherTypes';
import { cn } from '@/shared/utils/cn';

interface PartitionHierarchySvgProps {
  activeSlot: ActiveSlot;
  onSelectPartition: (partitionName: string) => void;
  selectedPartition: string;
}

export function PartitionHierarchySvg({
  activeSlot,
  onSelectPartition,
  selectedPartition,
}: PartitionHierarchySvgProps) {
  return (
    <div className="relative flex min-h-[260px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-background/60 p-3">
      <svg
        aria-label="Android Partition Flowchart"
        className="h-full max-h-[320px] w-full"
        fill="none"
        viewBox="0 0 760 300"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="primaryGrad" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="slotAGrad" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop
              offset="0%"
              stopColor={activeSlot === 'a' ? 'var(--chart-2)' : 'var(--border)'}
              stopOpacity="0.7"
            />
            <stop
              offset="100%"
              stopColor={activeSlot === 'a' ? 'var(--chart-2)' : 'var(--border)'}
              stopOpacity="0.2"
            />
          </linearGradient>
          <linearGradient id="slotBGrad" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop
              offset="0%"
              stopColor={activeSlot === 'b' ? 'var(--chart-2)' : 'var(--border)'}
              stopOpacity="0.7"
            />
            <stop
              offset="100%"
              stopColor={activeSlot === 'b' ? 'var(--chart-2)' : 'var(--border)'}
              stopOpacity="0.2"
            />
          </linearGradient>
        </defs>

        {/* Level 1: Primary Bootloader */}
        <g className="cursor-pointer" onClick={() => onSelectPartition('bootloader')}>
          <rect
            className="stroke-border/80 transition-all hover:stroke-foreground"
            fill="var(--surface-raised)"
            height="36"
            rx="8"
            strokeWidth="1.5"
            width="260"
            x="250"
            y="10"
          />
          <text
            className="fill-foreground font-semibold text-[12px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="380"
            y="28"
          >
            Primary Bootloader (XBL / ABOOT)
          </text>
        </g>

        {/* Lines from Bootloader to Slots */}
        <path
          d="M 380 46 L 380 65 M 380 65 L 200 65 M 380 65 L 560 65 M 200 65 L 200 80 M 560 65 L 560 80"
          fill="none"
          stroke="var(--border)"
          strokeDasharray="4 2"
          strokeWidth="1.5"
        />

        {/* Level 2: Dual Slots */}
        {/* Slot A */}
        <g className="cursor-pointer" onClick={() => onSelectPartition('boot')}>
          <rect
            className={cn(
              'transition-all',
              activeSlot === 'a' ? 'stroke-success' : 'stroke-border',
            )}
            fill="var(--surface)"
            height="38"
            rx="8"
            strokeWidth={activeSlot === 'a' ? '2' : '1'}
            width="190"
            x="105"
            y="80"
          />
          <text
            className="fill-foreground font-semibold text-[12px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="200"
            y="95"
          >
            SLOT A {activeSlot === 'a' ? '🟢 (ACTIVE)' : '⚪ (INACTIVE)'}
          </text>
          <text
            className="fill-muted-foreground text-[10px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="200"
            y="108"
          >
            boot_a / init_boot_a / vbmeta_a
          </text>
        </g>

        {/* Slot B */}
        <g className="cursor-pointer" onClick={() => onSelectPartition('boot')}>
          <rect
            className={cn(
              'transition-all',
              activeSlot === 'b' ? 'stroke-success' : 'stroke-border',
            )}
            fill="var(--surface)"
            height="38"
            rx="8"
            strokeWidth={activeSlot === 'b' ? '2' : '1'}
            width="190"
            x="465"
            y="80"
          />
          <text
            className="fill-foreground font-semibold text-[12px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="560"
            y="95"
          >
            SLOT B {activeSlot === 'b' ? '🟢 (ACTIVE)' : '⚪ (INACTIVE)'}
          </text>
          <text
            className="fill-muted-foreground text-[10px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="560"
            y="108"
          >
            boot_b / init_boot_b / vbmeta_b
          </text>
        </g>

        {/* Lines from Slots to Kernel / AVB Layer */}
        <path
          d="M 200 118 L 200 145 M 560 118 L 560 145 M 200 145 L 560 145 M 380 145 L 380 155"
          fill="none"
          stroke="var(--border)"
          strokeDasharray="4 2"
          strokeWidth="1.5"
        />

        {/* Level 3: Core Kernel & AVB Security Box */}
        <g className="cursor-pointer" onClick={() => onSelectPartition('boot')}>
          <rect
            className={cn(
              'transition-all',
              selectedPartition === 'boot' || selectedPartition === 'init_boot'
                ? 'stroke-primary'
                : 'stroke-border/80',
            )}
            fill="var(--surface-raised)"
            height="46"
            rx="8"
            strokeWidth="1.5"
            width="340"
            x="40"
            y="155"
          />
          <text
            className="fill-foreground font-semibold text-[11px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="210"
            y="172"
          >
            Core Kernel & Ramdisk Layer
          </text>
          <text
            className="fill-muted-foreground text-[10px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="210"
            y="188"
          >
            boot.img · init_boot.img · vendor_boot.img · dtbo.img
          </text>
        </g>

        {/* Level 3: AVB 2.0 Chain */}
        <g className="cursor-pointer" onClick={() => onSelectPartition('vbmeta')}>
          <rect
            className={cn(
              'transition-all',
              selectedPartition.startsWith('vbmeta') ? 'stroke-primary' : 'stroke-border/80',
            )}
            fill="var(--surface-raised)"
            height="46"
            rx="8"
            strokeWidth="1.5"
            width="340"
            x="390"
            y="155"
          />
          <text
            className="fill-foreground font-semibold text-[11px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="560"
            y="172"
          >
            AVB 2.0 Verification Chained Hashes
          </text>
          <text
            className="fill-muted-foreground text-[10px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="560"
            y="188"
          >
            vbmeta.img · vbmeta_system.img · vbmeta_vendor.img
          </text>
        </g>

        {/* Lines from Level 3 to Dynamic Super Container */}
        <path
          d="M 210 201 L 210 215 M 560 201 L 560 215 M 210 215 L 560 215 M 380 215 L 380 225"
          fill="none"
          stroke="var(--border)"
          strokeDasharray="4 2"
          strokeWidth="1.5"
        />

        {/* Level 4: Dynamic Partitions: super.img */}
        <g className="cursor-pointer" onClick={() => onSelectPartition('super')}>
          <rect
            className={cn(
              'transition-all',
              selectedPartition === 'super' || selectedPartition === 'system'
                ? 'stroke-primary'
                : 'stroke-border/80',
            )}
            fill="var(--surface)"
            height="55"
            rx="8"
            strokeWidth="1.5"
            width="690"
            x="40"
            y="225"
          />
          <text
            className="fill-foreground font-semibold text-[12px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="385"
            y="242"
          >
            Dynamic Partition Container (super.img / FastbootD)
          </text>
          <text
            className="fill-muted-foreground text-[10px]"
            dominantBaseline="middle"
            textAnchor="middle"
            x="385"
            y="262"
          >
            system.img (OS/ART) · vendor.img (HALs) · product.img (OEM Apps) · system_ext.img ·
            odm.img
          </text>
        </g>
      </svg>
    </div>
  );
}
