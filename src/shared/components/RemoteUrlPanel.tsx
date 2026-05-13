import { AlertCircle, CheckCircle2, Globe, Loader2, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/shared/ui/input-group';
import { Switch } from '@/shared/ui/switch';

export type ConnectionStatus = 'idle' | 'checking' | 'ready' | 'error';

interface RemoteUrlPanelProps {
  connectionStatus: ConnectionStatus;
  disabled?: boolean;
  estimatedSize: string | null;
  onCheckUrl: () => void;
  onPrefetchChange: (prefetch: boolean) => void;
  onUrlChange: (url: string) => void;
  prefetch: boolean;
  url: string;
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
          <FieldLabel className="flex items-center gap-2" htmlFor="remote-url">
            <Globe className="h-4 w-4" />
            Payload URL
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              autoComplete="off"
              className="min-w-0 flex-1"
              disabled={disabled}
              id="remote-url"
              inputMode="url"
              name="remote-payload-url"
              onChange={(e) => {
                onUrlChange(e.target.value);
              }}
              placeholder="https://example.com/ota.zip"
              type="url"
              value={url}
            />
            {url && !disabled ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Clear URL"
                  onClick={() => {
                    onUrlChange('');
                  }}
                  size="icon-xs"
                >
                  <X className="h-4 w-4" />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </Field>
      </FieldGroup>

      {/* Check URL Button */}
      <Button
        className="w-full"
        disabled={!url.trim() || isChecking || disabled}
        onClick={onCheckUrl}
        variant="outline"
      >
        {isChecking ? (
          <>
            <Loader2 className="animate-spin" data-icon="inline-start" />
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
        <Field data-disabled={disabled} orientation="horizontal">
          <Switch
            checked={prefetch}
            disabled={disabled}
            id="prefetch"
            onCheckedChange={(checked) => {
              onPrefetchChange(checked);
            }}
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
          className={isReady ? 'border-success/50 text-success' : undefined}
          variant={isError ? 'destructive' : 'default'}
        >
          {isChecking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Checking connection...</AlertTitle>
            </>
          ) : null}
          {isReady ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Range requests supported</AlertTitle>
              {estimatedSize ? (
                <AlertDescription>Estimated download: {estimatedSize}</AlertDescription>
              ) : null}
            </>
          ) : null}
          {isError ? (
            <>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection check failed</AlertTitle>
              <AlertDescription>
                Server does not support range requests or URL is invalid
              </AlertDescription>
            </>
          ) : null}
        </Alert>
      )}
    </div>
  );
}
