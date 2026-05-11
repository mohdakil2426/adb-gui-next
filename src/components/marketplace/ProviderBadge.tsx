import { GitBranch, Package, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { backend } from "@/lib/desktop/models";
import { cn } from "@/lib/utils";

type ProviderSource = backend.ProviderSource;

const PROVIDER_CONFIG: Record<
  ProviderSource,
  { label: string; icon: typeof GitBranch }
> = {
  "F-Droid": {
    label: "F-Droid",
    icon: Package,
  },
  GitHub: {
    label: "GitHub",
    icon: GitBranch,
  },
  Aptoide: {
    label: "Aptoide",
    icon: Store,
  },
};

interface ProviderBadgeProps {
  className?: string;
  compact?: boolean;
  source: string;
}

export function ProviderBadge({
  source,
  compact = false,
  className,
}: ProviderBadgeProps) {
  const config = PROVIDER_CONFIG[source as ProviderSource];

  if (!config) {
    return (
      <Badge
        className={cn("gap-1 px-2 py-0.5 text-[10px]", className)}
        variant="outline"
      >
        {source}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge
      className={cn(
        "gap-1 rounded-full border-border/70 bg-muted/40 px-2 py-0.5 font-medium text-[10px] text-muted-foreground",
        className
      )}
      variant="outline"
    >
      <Icon className="size-3" />
      {!compact && <span>{config.label}</span>}
    </Badge>
  );
}
