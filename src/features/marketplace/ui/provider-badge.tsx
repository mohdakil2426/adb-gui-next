import { GitBranch, Package, Store } from "lucide-react";

import type { backend } from "@/desktop/models";
import { Badge } from "@/shared/ui/badge";

type ProviderSource = backend.ProviderSource;

const PROVIDER_CONFIG: Record<ProviderSource, { label: string; icon: typeof GitBranch }> = {
  Aptoide: {
    icon: Store,
    label: "Aptoide",
  },
  "F-Droid": {
    icon: Package,
    label: "F-Droid",
  },
  GitHub: {
    icon: GitBranch,
    label: "GitHub",
  },
};

interface ProviderBadgeProps {
  className?: string;
  compact?: boolean;
  source: string;
}

export const ProviderBadge = ({ source, compact = false, className }: ProviderBadgeProps) => {
  const config = PROVIDER_CONFIG[source as ProviderSource];

  if (!config) {
    return (
      <Badge className={className} variant="outline">
        {source}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge className={className} variant="neutral">
      <Icon aria-hidden="true" />
      {compact ? null : <span>{config.label}</span>}
    </Badge>
  );
};
