import { m, useReducedMotion } from 'framer-motion';
import { TONE_FILL, type Tone } from '@/features/dashboard/model/tone';
import { cn } from '@/shared/utils/cn';

export interface PostureItem {
  id: string;
  tone: Tone;
}

interface PostureSpectrumProps {
  items: PostureItem[];
}

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

/**
 * One segment per security diagnostic. The strip reads left-to-right as the
 * device's posture at a glance; each segment lights in its row's tone.
 */
export function PostureSpectrum({ items }: PostureSpectrumProps) {
  const shouldReduceMotion = useReducedMotion();
  const nominal = items.filter((item) => item.tone === 'ok').length;

  return (
    <div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {items.map((item, index) => (
          <m.div
            animate={{ opacity: 1, scaleX: 1 }}
            aria-hidden="true"
            className={cn('h-full flex-1 origin-left rounded-sm', TONE_FILL[item.tone])}
            initial={shouldReduceMotion ? false : { opacity: 0, scaleX: 0 }}
            key={item.id}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.32, delay: 0.1 + index * 0.05, ease: EASE_STANDARD }
            }
          />
        ))}
      </div>
      <p className="flex items-center justify-between pt-1.5 text-caption text-muted-foreground">
        <span>Posture</span>
        <span className="numeric">
          {nominal} of {items.length} nominal
        </span>
      </p>
    </div>
  );
}
