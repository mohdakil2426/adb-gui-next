import { FileArchive, Globe, XCircle } from 'lucide-react';
import { DropZone } from '@/components/DropZone';
import { type ConnectionStatus, RemoteUrlPanel } from '@/components/RemoteUrlPanel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ACCEPTED_PAYLOAD_EXTENSIONS = ['.bin', '.zip', '.ops', '.ofp'];

interface PayloadSourceTabsProps {
  connectionStatus: ConnectionStatus;
  disabled: boolean;
  estimatedSize: string | null;
  isLoadingPartitions: boolean;
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
}: PayloadSourceTabsProps) {
  return (
    <Tabs
      className="w-full"
      onValueChange={(v) => {
        onModeChange(v as 'local' | 'remote');
      }}
      value={mode}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger className="flex items-center gap-2" value="local">
          <FileArchive className="h-4 w-4" />
          Local File
        </TabsTrigger>
        <TabsTrigger className="flex items-center gap-2" value="remote">
          <Globe className="h-4 w-4" />
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
          disabled={disabled}
          estimatedSize={estimatedSize}
          onCheckUrl={onCheckUrl}
          onPrefetchChange={onPrefetchChange}
          onUrlChange={onUrlChange}
          prefetch={prefetch}
          url={remoteUrl}
        />
        {connectionStatus === 'ready' && (
          <div className="mt-4 flex min-w-0 gap-2">
            {isLoadingPartitions ? (
              <Button className="flex-1" onClick={onCancelLoadPartitions} variant="destructive">
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Loading...
              </Button>
            ) : (
              <Button className="w-full" onClick={onLoadRemotePartitions}>
                <Globe className="mr-2 h-4 w-4" />
                Load Partitions from URL
              </Button>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
