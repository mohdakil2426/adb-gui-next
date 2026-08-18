import type {
  DebloatListFilter,
  RemovalFilter,
  StateFilter,
} from '@/features/app-manager/debloater/model/debloatStore';

export const OEM_LIST_OPTIONS: { value: DebloatListFilter; label: string }[] = [
  { value: 'All', label: 'All Lists (AOSP, OEM, Carrier)' },
  { value: 'Google', label: 'Google Services' },
  { value: 'Oem', label: 'Samsung / Xiaomi / OEM' },
  { value: 'Carrier', label: 'Carrier Bloatware' },
  { value: 'Aosp', label: 'AOSP Core System' },
  { value: 'Misc', label: 'Miscellaneous' },
  { value: 'Pending', label: 'Pending Review' },
  { value: 'Unlisted', label: 'Unlisted Packages' },
];

export const STATE_OPTIONS: { value: StateFilter; label: string }[] = [
  { value: 'All', label: 'All Package States' },
  { value: 'Enabled', label: 'Enabled Only' },
  { value: 'Disabled', label: 'Disabled Only' },
  { value: 'Uninstalled', label: 'Uninstalled Only' },
];

export interface SafetyChipDef {
  active: string;
  dot: string;
  label: string;
  tier: RemovalFilter;
}

export const SAFETY_CHIP_DEFS: SafetyChipDef[] = [
  {
    tier: 'All',
    label: 'All Tiers',
    dot: 'bg-muted-foreground',
    active: 'border-primary bg-primary text-primary-foreground',
  },
  {
    tier: 'Recommended',
    label: 'Recommended',
    dot: 'bg-success',
    active: 'border-success/60 bg-success-muted text-success font-semibold shadow-xs',
  },
  {
    tier: 'Advanced',
    label: 'Advanced',
    dot: 'bg-info',
    active: 'border-info/60 bg-info-muted text-info font-semibold shadow-xs',
  },
  {
    tier: 'Expert',
    label: 'Expert',
    dot: 'bg-warning',
    active: 'border-warning/60 bg-warning-muted text-warning font-semibold shadow-xs',
  },
  {
    tier: 'Unsafe',
    label: 'Unsafe',
    dot: 'bg-destructive',
    active: 'border-destructive/60 bg-destructive-muted text-destructive font-semibold shadow-xs',
  },
  {
    tier: 'Unlisted',
    label: 'Unlisted',
    dot: 'bg-muted-foreground',
    active: 'border-border bg-accent text-foreground font-semibold',
  },
];
