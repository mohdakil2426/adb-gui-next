import { Copy, ExternalLink, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { BrowserOpenURL } from '@/desktop/runtime';
import { Button } from '@/shared/ui/button';
import { formatDisplayDate } from '@/shared/utils/formatting';

function MetadataItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="mt-0.5 font-medium text-sm">{value}</span>
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
  version,
  updatedAt,
  license,
  author,
  repoUrl,
  source,
  packageName,
}: AppDetailSidebarProps) {
  return (
    <section className="gap-4">
      <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
        App Information
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6">
        <MetadataItem label="Version" value={version} />
        <MetadataItem label="Updated" value={updatedAt ? formatDisplayDate(updatedAt) : null} />
        <MetadataItem label="License" value={license} />
        <MetadataItem label="Author" value={author} />
      </div>
      {repoUrl ? (
        <div className="pt-2">
          <Button
            className="w-full"
            onClick={() => {
              BrowserOpenURL(repoUrl);
            }}
            variant="outline"
          >
            {source === 'GitHub' ? (
              <GitBranch aria-hidden="true" data-icon="inline-start" />
            ) : (
              <ExternalLink aria-hidden="true" data-icon="inline-start" />
            )}
            Open Repository
          </Button>
        </div>
      ) : null}
      <Button
        className="mt-2 w-full text-muted-foreground hover:text-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(packageName);
            toast.success('Package name copied');
          } catch {
            toast.error('Unable to copy package name');
          }
        }}
        variant="ghost"
      >
        <Copy aria-hidden="true" data-icon="inline-start" /> Copy Package ID
      </Button>
    </section>
  );
}
