import { FileArchive, Globe, XCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DropZone } from '@/components/DropZone';
import { RemoteUrlPanel, type ConnectionStatus } from '@/components/RemoteUrlPanel';

interface PayloadSourceTabsProps {
  mode: 'local' | 'remote';
  onModeChange: (mode: 'local' | 'remote') => void;
  remoteUrl: string;
  onUrlChange: (url: string) => void;
  prefetch: boolean;
  onPrefetchChange: (prefetch: boolean) => void;
  connectionStatus: ConnectionStatus;
  estimatedSize: string | null;
  onCheckUrl: () => void;
  onSelectPayload: () => void;
  onPayloadDrop: (paths: string[]) => void;
  isLoadingPartitions: boolean;
  onLoadRemotePartitions: () => void;
  onCancelLoadPartitions: () => void;
  disabled: boolean;
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
      value={mode}
      onValueChange={(v) => onModeChange(v as 'local' | 'remote')}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="local" className="flex items-center gap-2">
          <FileArchive className="h-4 w-4" />
          Local File
        </TabsTrigger>
        <TabsTrigger value="remote" className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Remote URL
        </TabsTrigger>
      </TabsList>

      <TabsContent value="local" className="mt-4">
        <DropZone
          onFilesDropped={onPayloadDrop}
          onBrowse={onSelectPayload}
          acceptExtensions={['.bin', '.zip']}
          rejectMessage="Only payload.bin or .zip files are accepted"
          icon={FileArchive}
          label="Drop payload.bin or OTA zip here"
          browseLabel="Select Payload File"
          sublabel="Accepts .bin and .zip files"
          disabled={disabled}
        />
      </TabsContent>

      <TabsContent value="remote" className="mt-4 min-w-0 overflow-hidden">
        <RemoteUrlPanel
          url={remoteUrl}
          onUrlChange={onUrlChange}
          prefetch={prefetch}
          onPrefetchChange={onPrefetchChange}
          connectionStatus={connectionStatus}
          estimatedSize={estimatedSize}
          onCheckUrl={onCheckUrl}
          disabled={disabled}
        />
        {connectionStatus === 'ready' && (
          <div className="mt-4 flex gap-2 min-w-0">
            {isLoadingPartitions ? (
              <Button variant="destructive" className="flex-1" onClick={onCancelLoadPartitions}>
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
