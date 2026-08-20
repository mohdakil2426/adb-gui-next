import { Loader2, PlugZap, Usb, Wifi } from 'lucide-react';
import type { WirelessAdbController } from '@/features/dashboard/hooks/useWirelessAdb';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { Button } from '@/shared/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/utils/cn';

interface WirelessAdbPanelProps {
  /** `true` once the selected device is reachable over the network. */
  isConnected: boolean;
  /** `tcpip` must be enabled over USB first; hidden when no ADB device is present. */
  showEnableStep: boolean;
  wireless: WirelessAdbController;
}

export function WirelessAdbPanel({ isConnected, showEnableStep, wireless }: WirelessAdbPanelProps) {
  const { form, ip, isBusy, isConnecting, isDisconnecting, isEnablingTcpip } = wireless;
  const { errors, isSubmitting } = form.formState;
  const isPending = isBusy || isConnecting || isDisconnecting || isSubmitting;
  return (
    <PanelCard
      action={
        <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 rounded-full',
              isConnected ? 'bg-success' : 'bg-foreground-subtle',
            )}
          />
          {isConnected ? 'Connected' : 'Not connected'}
        </span>
      }
      icon={Wifi}
      title="Wireless ADB"
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit(async (values) => {
          await wireless.connect(values);
        })}
      >
        <FieldGroup>
          <div className="grid @sm:grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
            <Field data-invalid={Boolean(errors.ip)}>
              <FieldLabel htmlFor="dashboard-wireless-ip">Device IP address</FieldLabel>
              <Input
                aria-describedby={errors.ip ? 'dashboard-wireless-ip-error' : undefined}
                aria-invalid={Boolean(errors.ip)}
                autoComplete="off"
                disabled={isPending}
                id="dashboard-wireless-ip"
                placeholder="192.168.1.14"
                required
                {...form.register('ip')}
              />
              {errors.ip ? (
                <FieldDescription className="text-destructive" id="dashboard-wireless-ip-error">
                  {errors.ip.message}
                </FieldDescription>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(errors.port)}>
              <FieldLabel htmlFor="dashboard-wireless-port">Port</FieldLabel>
              <Input
                aria-describedby={errors.port ? 'dashboard-wireless-port-error' : undefined}
                aria-invalid={Boolean(errors.port)}
                autoComplete="off"
                disabled={isPending}
                id="dashboard-wireless-port"
                inputMode="numeric"
                placeholder="5555"
                required
                {...form.register('port')}
              />
              {errors.port ? (
                <FieldDescription className="text-destructive" id="dashboard-wireless-port-error">
                  {errors.port.message}
                </FieldDescription>
              ) : null}
            </Field>
          </div>
        </FieldGroup>

        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" disabled={isPending || !ip} size="sm" type="submit">
            {isConnecting || isSubmitting ? (
              <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
            ) : (
              <Wifi aria-hidden="true" data-icon="inline-start" />
            )}
            Connect
          </Button>
          <Button
            className="flex-1"
            disabled={isPending || !ip}
            onClick={() => {
              void wireless.disconnect();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {isDisconnecting ? (
              <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
            ) : (
              <PlugZap aria-hidden="true" data-icon="inline-start" />
            )}
            Disconnect
          </Button>
        </div>
      </form>

      {showEnableStep ? (
        <div className="mt-3 flex flex-col gap-2 border-border border-t pt-3">
          <p className="text-caption text-muted-foreground">
            First time on this network? Enable TCP/IP mode while the device is on USB.
          </p>
          <Button
            disabled={isBusy}
            onClick={() => {
              void wireless.enableTcpip();
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {isEnablingTcpip ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Usb aria-hidden="true" />
            )}
            Enable wireless mode (tcpip 5555)
          </Button>
        </div>
      ) : null}
    </PanelCard>
  );
}
