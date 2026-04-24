import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle2, AlertCircle, X, Globe } from 'lucide-react';

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
    <div className="flex min-w-0 flex-col gap-4">
      {/* URL Input */}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="remote-url" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Payload URL
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="remote-url"
              name="remote-payload-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://example.com/ota.zip"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              className="flex-1 min-w-0"
              disabled={disabled}
            />
            {url && !disabled && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear URL"
                  onClick={() => onUrlChange('')}
                >
                  <X className="h-4 w-4" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </Field>
      </FieldGroup>

      {/* Check URL Button */}
      <Button
        variant="outline"
        onClick={onCheckUrl}
        disabled={!url.trim() || isChecking || disabled}
        className="w-full"
      >
        {isChecking ? (
          <>
            <Loader2 data-icon="inline-start" className="animate-spin" />
            Checking connection...
          </>
        ) : (
          <>
            <Globe data-icon="inline-start" />
            Check URL
          </>
        )}
      </Button>

      {/* Options */}
      <FieldGroup>
        <Field orientation="horizontal" data-disabled={disabled}>
          <Switch
            id="prefetch"
            checked={prefetch}
            onCheckedChange={(checked) => onPrefetchChange(checked === true)}
            disabled={disabled}
          />
          <FieldContent>
            <FieldLabel htmlFor="prefetch">Prefetch mode</FieldLabel>
            <FieldDescription>Download before extraction.</FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>

      {/* Connection Status */}
      {connectionStatus !== 'idle' && (
        <Alert
          variant={isError ? 'destructive' : 'default'}
          className={isReady ? 'border-success/50 text-success' : undefined}
        >
          {isChecking && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Checking connection...</AlertTitle>
            </>
          )}
          {isReady && (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Range requests supported</AlertTitle>
              {estimatedSize && (
                <AlertDescription>Estimated download: {estimatedSize}</AlertDescription>
              )}
            </>
          )}
          {isError && (
            <>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection check failed</AlertTitle>
              <AlertDescription>
                Server does not support range requests or URL is invalid
              </AlertDescription>
            </>
          )}
        </Alert>
      )}
    </div>
  );
}
