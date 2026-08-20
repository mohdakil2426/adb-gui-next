import { FileArchive, Globe } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { RemoteLoadProgressCard } from '@/features/payload-dumper/ui/RemoteLoadProgressCard';
import { DropZone } from '@/shared/components/DropZone';
import { type ConnectionStatus, RemoteUrlPanel } from '@/shared/components/RemoteUrlPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const ACCEPTED_PAYLOAD_EXTENSIONS = ['.bin', '.zip', '.ops', '.ofp'];

export interface PayloadSourceTabsProps {
  connectionStatus: ConnectionStatus;
  disabled: boolean;
  estimatedSize: string | null;
  isLoadingPartitions: boolean;
  loadDetail?: string | null | undefined;
  loadMessage?: string | undefined;
  loadPhase?: backend.PayloadLoadPhase | null | undefined;
  loadStartedAt?: number | null | undefined;
  loadStep?: number | undefined;
  loadTotalSteps?: number | undefined;
  mode: 'local' | 'remote';
  onCancelLoadPartitions: () => void;
  onCheckUrl: () => void;
  onLoadRemotePartitions: () => void;
  onModeChange: (mode: 'local' | 'remote') => void;
  onPayloadDrop: (paths: string[]) => void;
  onPrefetchChange: (prefetch: boolean) => void;
  onSelectPayload: () => void;
  onUrlChange: (url: string) => void;
  prefetch: boolean;
  remoteUrl: string;
}

export function PayloadSourceTabs({
  mode,
  onModeChange,
  remoteUrl,
  onUrlChange,
  prefetch,
  onPrefetchChange,
  connectionStatus,
  estimatedSize,
  onCheckUrl,
  onSelectPayload,
  onPayloadDrop,
  isLoadingPartitions,
  onLoadRemotePartitions,
  onCancelLoadPartitions,
  disabled,
  loadPhase = null,
  loadMessage = '',
  loadDetail = null,
  loadStep = 0,
  loadTotalSteps = 4,
  loadStartedAt = null,
}: PayloadSourceTabsProps) {
  const showLoadCard = isLoadingPartitions && mode === 'remote';

  return (
    <Tabs
      className="w-full"
      onValueChange={(v) => onModeChange(v as 'local' | 'remote')}
      value={mode}
    >
      <TabsList className="w-full">
        <TabsTrigger className="flex-1" disabled={showLoadCard} value="local">
          <FileArchive aria-hidden="true" className="mr-2 size-4" />
          Local File Archive (.bin, .zip, .ops, .ofp)
        </TabsTrigger>
        <TabsTrigger className="flex-1" value="remote">
          <Globe aria-hidden="true" className="mr-2 size-4" />
          Remote OTA URL Stream (HTTP / HTTPS)
        </TabsTrigger>
      </TabsList>

      {/* Tab 1: Local File DropZone */}
      <TabsContent className="mt-4" value="local">
        <DropZone
          acceptExtensions={ACCEPTED_PAYLOAD_EXTENSIONS}
          browseLabel="Select Payload File"
          disabled={disabled}
          icon={FileArchive}
          label="Drop payload.bin, OTA zip, or firmware archive here"
          onBrowse={onSelectPayload}
          onFilesDropped={onPayloadDrop}
          rejectMessage="Only payload.bin, .zip, .ops, or .ofp files are accepted"
          sublabel="Supports Android A/B payload.bin, Google factory zips, OnePlus OPS, and Oppo OFP"
        />
      </TabsContent>

      {/* Tab 2: Remote URL Streaming */}
      <TabsContent className="mt-4 flex min-w-0 flex-col gap-3" value="remote">
        <RemoteUrlPanel
          connectionStatus={connectionStatus}
          disabled={disabled || showLoadCard}
          estimatedSize={estimatedSize}
          onCheckUrl={onCheckUrl}
          onLoadPartitions={onLoadRemotePartitions}
          onPrefetchChange={onPrefetchChange}
          onUrlChange={onUrlChange}
          prefetch={prefetch}
          url={remoteUrl}
        />

        {showLoadCard ? (
          <div className="mt-1">
            <RemoteLoadProgressCard
              detail={loadDetail}
              estimatedSizeLabel={estimatedSize}
              message={loadMessage}
              onCancel={onCancelLoadPartitions}
              phase={loadPhase}
              startedAt={loadStartedAt ?? Date.now()}
              step={loadStep}
              totalSteps={loadTotalSteps}
            />
          </div>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
