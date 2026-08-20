import { Copy, ExternalLink, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { BrowserOpenURL } from '@/desktop/runtime';
import { Button } from '@/shared/ui/button';
import { formatDisplayDate } from '@/shared/utils/format';

function MetadataItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="truncate font-medium text-body text-foreground">{value}</span>
    </div>
  );
}

interface AppDetailSidebarProps {
  author?: string | null | undefined;
  license?: string | null | undefined;
  packageName: string;
  repoUrl?: string | null;
  source: string;
  updatedAt?: string | null | undefined;
  version?: string | null;
}

export function AppDetailSidebar({
  author,
  license,
  packageName,
  repoUrl,
  source,
  updatedAt,
  version,
}: AppDetailSidebarProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-caption text-muted-foreground uppercase tracking-wide">
        App information
      </h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <MetadataItem label="Version" value={version} />
        <MetadataItem label="Updated" value={updatedAt ? formatDisplayDate(updatedAt) : null} />
        <MetadataItem label="License" value={license} />
        <MetadataItem label="Author" value={author} />
      </div>

      <div className="flex flex-col gap-1.5">
        {repoUrl ? (
          <Button
            className="w-full"
            onClick={() => {
              BrowserOpenURL(repoUrl);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {source === 'GitHub' ? (
              <GitBranch aria-hidden="true" />
            ) : (
              <ExternalLink aria-hidden="true" />
            )}
            Open repository
          </Button>
        ) : null}
        <Button
          className="w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(packageName);
              toast.success('Package name copied');
            } catch {
              toast.error('Unable to copy the package name', {
                description: 'Clipboard access was refused — select and copy the name manually.',
              });
            }
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Copy aria-hidden="true" data-icon="inline-start" />
          Copy package ID
        </Button>
      </div>
    </section>
  );
}
