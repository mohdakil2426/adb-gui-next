import { CircleCheck, CircleHelp, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { ComponentType } from 'react';
import type { backend } from '@/desktop/models';
import { TONE_TEXT, type Tone } from '@/features/dashboard/model/tone';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { daysSince, EMPTY_VALUE, formatRelativeDate } from '@/shared/utils/format';

interface SecurityPanelProps {
  isLoading: boolean;
  security: backend.SecurityInfo | null;
}

interface SecurityRow {
  hint?: string;
  label: string;
  tone: Tone;
  value: string;
}

const TONE_ICON: Record<Tone, ComponentType<{ className?: string }>> = {
  ok: CircleCheck,
  warn: TriangleAlert,
  danger: ShieldAlert,
  neutral: CircleHelp,
};

const UNKNOWN: Pick<SecurityRow, 'tone' | 'value'> = { tone: 'neutral', value: 'Unknown' };

/** Android ships a monthly patch; half a year behind is a real exposure. */
const PATCH_WARN_DAYS = 180;
const PATCH_DANGER_DAYS = 365;

const VERIFIED_BOOT: Record<string, Pick<SecurityRow, 'tone' | 'value'>> = {
  green: { tone: 'ok', value: 'Green — verified' },
  yellow: { tone: 'warn', value: 'Yellow — self-signed' },
  orange: { tone: 'warn', value: 'Orange — unlocked' },
  red: { tone: 'danger', value: 'Red — verification failed' },
};

const ENCRYPTION: Record<string, Pick<SecurityRow, 'tone' | 'value'>> = {
  encrypted: { tone: 'ok', value: 'Encrypted' },
  file: { tone: 'ok', value: 'File-based' },
  block: { tone: 'ok', value: 'Full-disk' },
  unencrypted: { tone: 'warn', value: 'Not encrypted' },
  unsupported: { tone: 'warn', value: 'Unsupported' },
};

function patchRow(patch: string | null): SecurityRow {
  if (!patch) {
    return { label: 'Security patch', ...UNKNOWN };
  }
  const age = daysSince(patch);
  if (age === null) {
    return { label: 'Security patch', tone: 'neutral', value: patch };
  }
  let tone: Tone = 'ok';
  if (age >= PATCH_DANGER_DAYS) {
    tone = 'danger';
  } else if (age >= PATCH_WARN_DAYS) {
    tone = 'warn';
  }
  return { label: 'Security patch', tone, value: patch, hint: formatRelativeDate(patch) };
}

function buildRows(security: backend.SecurityInfo): SecurityRow[] {
  const verifiedBoot = security.verifiedBootState?.toLowerCase();
  const encryption = security.encryptionState?.toLowerCase();

  return [
    {
      label: 'Root access',
      ...(security.rooted
        ? { tone: 'warn' as Tone, value: 'Rooted' }
        : { tone: 'ok' as Tone, value: 'Not rooted' }),
    },
    {
      label: 'Bootloader',
      ...(security.bootloaderUnlocked === null
        ? UNKNOWN
        : security.bootloaderUnlocked
          ? { tone: 'warn' as Tone, value: 'Unlocked' }
          : { tone: 'ok' as Tone, value: 'Locked' }),
    },
    {
      label: 'Verified boot',
      ...((verifiedBoot ? VERIFIED_BOOT[verifiedBoot] : undefined) ??
        (security.verifiedBootState
          ? { tone: 'neutral' as Tone, value: security.verifiedBootState }
          : UNKNOWN)),
    },
    {
      label: 'Encryption',
      ...((encryption ? ENCRYPTION[encryption] : undefined) ??
        (security.encryptionState
          ? { tone: 'neutral' as Tone, value: security.encryptionState }
          : UNKNOWN)),
    },
    {
      label: 'SELinux',
      ...(security.selinuxEnforcing === null
        ? UNKNOWN
        : security.selinuxEnforcing
          ? { tone: 'ok' as Tone, value: 'Enforcing' }
          : { tone: 'warn' as Tone, value: 'Permissive' }),
    },
    patchRow(security.securityPatch),
  ];
}

/**
 * Boot and security posture. Every row states what it *is*, with an affirmative
 * or warning marker — `"Root Status: Yes"` told the user nothing about whether
 * that was expected.
 */
export function SecurityPanel({ isLoading, security }: SecurityPanelProps) {
  if (isLoading && !security) {
    return (
      <PanelCard icon={ShieldCheck} title="Security & boot">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </PanelCard>
    );
  }

  const rows = security ? buildRows(security) : [];

  if (!security || rows.length === 0) {
    return (
      <PanelCard icon={ShieldCheck} title="Security & boot">
        <p className="text-body text-muted-foreground">{EMPTY_VALUE}</p>
      </PanelCard>
    );
  }
  return (
    <PanelCard icon={ShieldCheck} title="Security & boot">
      <div className="flex flex-1 flex-col justify-between gap-1.5">
        {rows.map((row) => {
          const Icon = TONE_ICON[row.tone];
          return (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-raised/40 px-3 py-2 transition-colors hover:bg-surface-raised/80"
              key={row.label}
            >
              <span className="truncate font-medium text-[12px] text-body text-foreground">
                {row.label}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <Icon aria-hidden="true" className={cn('size-3.5 shrink-0', TONE_TEXT[row.tone])} />
                <span className={cn('numeric font-medium text-[12px]', TONE_TEXT[row.tone])}>
                  {row.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}
