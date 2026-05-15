import { ChevronDown, Loader2, PlugZap, Usb, Wifi } from 'lucide-react';
import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import type { WirelessAdbValues } from '@/shared/utils/schemas';

export function WirelessAdbCard({
  deviceMode,
  handleConnect,
  handleDisconnect,
  handleEnableTcpip,
  isConnecting,
  isDisconnecting,
  isEnablingTcpip,
  selectedSerial,
  watchedIp,
  wirelessForm,
}: {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  handleConnect: (values: WirelessAdbValues) => void;
  handleDisconnect: () => void;
  handleEnableTcpip: () => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isEnablingTcpip: boolean;
  selectedSerial: string | null;
  watchedIp: string;
  wirelessForm: UseFormReturn<WirelessAdbValues>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible onOpenChange={setIsOpen} open={isOpen}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between" type="button">
              <CardTitle className="flex items-center gap-2">
                <Wifi className="size-5" />
                Wireless ADB Connection
              </CardTitle>
              <ChevronDown
                className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="font-medium">Step 1: Enable (via USB)</p>
              <p className="text-muted-foreground text-sm">
                Make sure the device is connected with a USB cable, then click this button..
              </p>
              <Button
                className="h-auto w-full whitespace-normal"
                disabled={
                  isEnablingTcpip || !selectedSerial || isConnecting || deviceMode !== 'adb'
                }
                onClick={handleEnableTcpip}
              >
                {isEnablingTcpip ? (
                  <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                ) : (
                  <Usb className="mr-2 size-4 shrink-0" />
                )}
                Enable Wireless Mode (tcpip)
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              <p className="font-medium">Step 2: Connect (via WiFi)</p>
              <p className="text-muted-foreground text-sm">
                Enter the Device IP (usually automatically filled in) and Port.
              </p>
              <form
                className="flex flex-col gap-3"
                onSubmit={wirelessForm.handleSubmit(handleConnect)}
              >
                <FieldGroup>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
                    <Field data-invalid={Boolean(wirelessForm.formState.errors.ip)}>
                      <FieldLabel htmlFor="dashboard-wireless-ip">Device IP Address</FieldLabel>
                      <Input
                        aria-describedby={wirelessForm.formState.errors.ip ? 'ip-error' : undefined}
                        aria-invalid={Boolean(wirelessForm.formState.errors.ip)}
                        autoComplete="off"
                        disabled={isConnecting || isDisconnecting}
                        id="dashboard-wireless-ip"
                        placeholder="Device IP Address"
                        {...wirelessForm.register('ip')}
                      />
                      {wirelessForm.formState.errors.ip ? (
                        <FieldDescription className="text-destructive" id="ip-error">
                          {wirelessForm.formState.errors.ip.message}
                        </FieldDescription>
                      ) : null}
                    </Field>
                    <Field data-invalid={Boolean(wirelessForm.formState.errors.port)}>
                      <FieldLabel htmlFor="dashboard-wireless-port">Wireless ADB Port</FieldLabel>
                      <Input
                        aria-describedby={
                          wirelessForm.formState.errors.port ? 'port-error' : undefined
                        }
                        aria-invalid={Boolean(wirelessForm.formState.errors.port)}
                        autoComplete="off"
                        disabled={isConnecting || isDisconnecting}
                        id="dashboard-wireless-port"
                        inputMode="numeric"
                        placeholder="Port"
                        {...wirelessForm.register('port')}
                      />
                      {wirelessForm.formState.errors.port ? (
                        <FieldDescription className="text-destructive" id="port-error">
                          {wirelessForm.formState.errors.port.message}
                        </FieldDescription>
                      ) : null}
                    </Field>
                  </div>
                </FieldGroup>
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full"
                    disabled={isConnecting || !watchedIp || isDisconnecting}
                    type="submit"
                  >
                    {isConnecting ? (
                      <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                    ) : (
                      <Wifi className="mr-2 size-4 shrink-0" />
                    )}
                    Connect
                  </Button>
                  <Button
                    className="w-full"
                    disabled={isDisconnecting || !watchedIp || isConnecting}
                    onClick={handleDisconnect}
                    type="button"
                    variant="outline"
                  >
                    {isDisconnecting ? (
                      <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                    ) : (
                      <PlugZap className="mr-2 size-4 shrink-0" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
