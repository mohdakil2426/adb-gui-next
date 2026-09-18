import type {
  DebloatListFilter,
  RemovalFilter,
  StateFilter,
} from "@/features/app-manager/debloater/model/debloat-store";

export const OEM_LIST_OPTIONS: { value: DebloatListFilter; label: string }[] = [
  { label: "All Lists (AOSP, OEM, Carrier)", value: "All" },
  { label: "Google Services", value: "Google" },
  { label: "Samsung / Xiaomi / OEM", value: "Oem" },
  { label: "Carrier Bloatware", value: "Carrier" },
  { label: "AOSP Core System", value: "Aosp" },
  { label: "Miscellaneous", value: "Misc" },
  { label: "Pending Review", value: "Pending" },
  { label: "Unlisted Packages", value: "Unlisted" },
];

export const STATE_OPTIONS: { value: StateFilter; label: string }[] = [
  { label: "All Package States", value: "All" },
  { label: "Enabled Only", value: "Enabled" },
  { label: "Disabled Only", value: "Disabled" },
  { label: "Uninstalled Only", value: "Uninstalled" },
];

export interface SafetyChipDef {
  active: string;
  dot: string;
  label: string;
  tier: RemovalFilter;
}

export const SAFETY_CHIP_DEFS: SafetyChipDef[] = [
  {
    active: "border-primary bg-primary text-primary-foreground",
    dot: "bg-muted-foreground",
    label: "All Tiers",
    tier: "All",
  },
  {
    active: "border-success/60 bg-success-muted text-success font-semibold shadow-xs",
    dot: "bg-success",
    label: "Recommended",
    tier: "Recommended",
  },
  {
    active: "border-info/60 bg-info-muted text-info font-semibold shadow-xs",
    dot: "bg-info",
    label: "Advanced",
    tier: "Advanced",
  },
  {
    active: "border-warning/60 bg-warning-muted text-warning font-semibold shadow-xs",
    dot: "bg-warning",
    label: "Expert",
    tier: "Expert",
  },
  {
    active: "border-destructive/60 bg-destructive-muted text-destructive font-semibold shadow-xs",
    dot: "bg-destructive",
    label: "Unsafe",
    tier: "Unsafe",
  },
  {
    active: "border-border bg-accent text-foreground font-semibold",
    dot: "bg-muted-foreground",
    label: "Unlisted",
    tier: "Unlisted",
  },
];
