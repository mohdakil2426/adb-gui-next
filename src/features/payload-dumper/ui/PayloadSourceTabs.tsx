import { FileArchive, Globe } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { DropZone } from '@/shared/components/DropZone';
import { type ConnectionStatus, RemoteUrlPanel } from '@/shared/components/RemoteUrlPanel';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { RemoteLoadProgressCard } from './RemoteLoadProgressCard';

const ACCEPTED_PAYLOAD_EXTENSIONS = ['.bin', '.zip', '.ops', '.ofp'];

interface PayloadSourceTabsProps {
  connectionStatus: ConnectionStatus;
  disabled: boolean;
  estimatedSize: string | null;
  isLoadingPartitions: boolean;
  loadDetail?: string | null;
  loadMessage?: string;
  loadPhase?: backend.PayloadLoadPhase | null;
  loadStartedAt?: number | null;
  loadStep?: number;
  loadTotalSteps?: number;
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

/**
 * Source selection tabs: Local File and Remote URL.
 * Shown when no payload is selected yet.
 */
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
      onValueChange={(v) => {
        onModeChange(v as 'local' | 'remote');
      }}
      value={mode}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger className="flex items-center gap-2" disabled={showLoadCard} value="local">
          <FileArchive className="size-4" />
          Local File
        </TabsTrigger>
        <TabsTrigger className="flex items-center gap-2" value="remote">
          <Globe className="size-4" />
          Remote URL
        </TabsTrigger>
      </TabsList>

      <TabsContent className="mt-4" value="local">
        <DropZone
          acceptExtensions={ACCEPTED_PAYLOAD_EXTENSIONS}
          browseLabel="Select Payload File"
          disabled={disabled}
          icon={FileArchive}
          label="Drop payload.bin, OTA zip, or firmware file here"
          onBrowse={onSelectPayload}
          onFilesDropped={onPayloadDrop}
          rejectMessage="Only payload.bin, .zip, .ops, or .ofp files are accepted"
          sublabel="Accepts .bin, .zip, .ops, and .ofp files"
        />
      </TabsContent>

      <TabsContent className="mt-4 min-w-0 overflow-hidden" value="remote">
        <RemoteUrlPanel
          connectionStatus={connectionStatus}
          disabled={disabled || showLoadCard}
          estimatedSize={estimatedSize}
          onCheckUrl={onCheckUrl}
          onPrefetchChange={onPrefetchChange}
          onUrlChange={onUrlChange}
          prefetch={prefetch}
          url={remoteUrl}
        />
        {showLoadCard ? (
          <div className="mt-4">
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
        {connectionStatus === 'ready' && !showLoadCard ? (
          <div className="mt-4 flex min-w-0 gap-2">
            <Button className="w-full" onClick={onLoadRemotePartitions}>
              <Globe className="mr-2 size-4" />
              Load Partitions from URL
            </Button>
          </div>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
