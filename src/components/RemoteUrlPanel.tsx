import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, AlertCircle, X, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConnectionStatus = 'idle' | 'checking' | 'ready' | 'error';

interface RemoteUrlPanelProps {
  url: string;
  onUrlChange: (url: string) => void;
  prefetch: boolean;
  onPrefetchChange: (prefetch: boolean) => void;
  connectionStatus: ConnectionStatus;
  estimatedSize: string | null;
  onCheckUrl: () => void;
  disabled?: boolean;
}

export function RemoteUrlPanel({
  url,
  onUrlChange,
  prefetch,
  onPrefetchChange,
  connectionStatus,
  estimatedSize,
  onCheckUrl,
  disabled = false,
}: RemoteUrlPanelProps) {
  const isChecking = connectionStatus === 'checking';
  const isReady = connectionStatus === 'ready';
  const isError = connectionStatus === 'error';

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="space-y-2">
        <Label htmlFor="remote-url" className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Payload URL
        </Label>
        <div className="flex gap-2">
          <Input
            id="remote-url"
            placeholder="https://example.com/ota.zip"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className="flex-1"
            disabled={disabled}
          />
          {url && !disabled && (
            <Button variant="ghost" size="icon" onClick={() => onUrlChange('')}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Check URL Button */}
      <Button
        variant="outline"
        onClick={onCheckUrl}
        disabled={!url.trim() || isChecking || disabled}
        className="w-full"
      >
        {isChecking ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Checking connection...
          </>
        ) : (
          <>
            <Globe className="mr-2 h-4 w-4" />
            Check URL
          </>
        )}
      </Button>

      {/* Options */}
      <div className="space-y-3">
        <Label className="text-muted-foreground">Options</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            id="prefetch"
            checked={prefetch}
            onCheckedChange={(checked) => onPrefetchChange(checked === true)}
            disabled={disabled}
          />
          <label htmlFor="prefetch" className="text-sm cursor-pointer">
            Prefetch mode (download before extraction)
          </label>
        </div>
      </div>

      {/* Connection Status */}
      {connectionStatus !== 'idle' && (
        <Card className={cn(isReady && 'border-success/50', isError && 'border-destructive/50')}>
          <CardContent className="pt-4 space-y-2">
            {isChecking && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking connection...
              </div>
            )}
            {isReady && (
              <>
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Range requests supported
                </div>
                {estimatedSize && (
                  <div className="text-sm text-muted-foreground">
                    Estimated download: {estimatedSize}
                  </div>
                )}
              </>
            )}
            {isError && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                Server does not support range requests or URL is invalid
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
