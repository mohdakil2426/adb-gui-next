import { m, useReducedMotion } from 'framer-motion';
import type { backend } from '@/desktop/models';
import { storageSegmentColor } from '@/features/dashboard/model/storageColors';

interface StorageAllocationBarProps {
  volumes: backend.StorageVolume[];
}

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

/**
 * The whole capacity picture in one track: every volume's used space as a
 * colored segment (matching the dot beside its row below), all free space as
 * one muted tail. Proportions are of the summed capacity, so volumes compare
 * honestly against each other.
 */
export function StorageAllocationBar({ volumes }: StorageAllocationBarProps) {
  const shouldReduceMotion = useReducedMotion();
  const totalCapacity = volumes.reduce((sum, volume) => sum + volume.totalBytes, 0);
  const totalFree = volumes.reduce((sum, volume) => sum + volume.freeBytes, 0);
  if (totalCapacity <= 0) {
    return null;
  }

  const segments = volumes.map((volume, index) => ({
    color: storageSegmentColor(index),
    key: volume.mount,
    width: (volume.usedBytes / totalCapacity) * 100,
  }));
  const freeWidth = (totalFree / totalCapacity) * 100;

  return (
    <div
      aria-label={`Storage allocation across ${volumes.length} ${volumes.length === 1 ? 'volume' : 'volumes'}, ${Math.round(100 - freeWidth)}% used`}
      className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-secondary"
      role="img"
    >
      {segments.map((segment, index) => (
        <m.div
          animate={{ opacity: 1, scaleX: 1 }}
          aria-hidden="true"
          className="h-full origin-left"
          initial={shouldReduceMotion ? false : { opacity: 0, scaleX: 0 }}
          key={segment.key}
          style={{ backgroundColor: segment.color, width: `${segment.width}%` }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.4, delay: 0.1 + index * 0.07, ease: EASE_STANDARD }
          }
        />
      ))}
      <m.div
        animate={{ opacity: 1 }}
        aria-hidden="true"
        className="h-full bg-secondary"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        style={{ width: `${freeWidth}%` }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.3 }}
      />
    </div>
  );
}
