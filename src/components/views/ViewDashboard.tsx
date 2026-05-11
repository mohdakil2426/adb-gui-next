import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Battery,
  Building,
  Code,
  Cpu,
  Database,
  Hash,
  Info,
  Loader2,
  PlugZap,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Tag,
  Usb,
  Wifi,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConnectedDevicesCard } from "@/components/ConnectedDevicesCard";
import { CopyButton } from "@/components/CopyButton";
import { EditNicknameDialog } from "@/components/EditNicknameDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { debugLog } from "@/lib/debug";
import { useDeviceStore } from "@/lib/deviceStore";
import { handleError, handleSuccess } from "@/lib/errorHandler";
import { queryKeys } from "@/lib/queries";
import { type WirelessAdbValues, wirelessAdbSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import {
  ConnectWirelessAdb,
  DisconnectWirelessAdb,
  EnableWirelessAdb,
  GetDeviceInfo,
} from "../../lib/desktop/backend";
import type { backend } from "../../lib/desktop/models";

export function ViewDashboard({ activeView }: { activeView: string }) {
  const queriedDevices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const deviceInfo = useDeviceStore((state) => state.deviceInfo);
  const setDeviceInfo = useDeviceStore((state) => state.setDeviceInfo);
  const queryClient = useQueryClient();
  const [isRefreshingInfo, setIsRefreshingInfo] = useState(false);
  const [isEnablingTcpip, setIsEnablingTcpip] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const isEditing = useDeviceStore((state) => state.isEditingNickname);
  const setIsEditing = useDeviceStore((state) => state.setIsEditingNickname);
  const editingSerial = useDeviceStore((state) => state.editingDeviceSerial);
  const setEditingSerial = useDeviceStore(
    (state) => state.setEditingDeviceSerial
  );

  const wirelessForm = useForm<WirelessAdbValues>({
    resolver: zodResolver(wirelessAdbSchema),
    defaultValues: { ip: "", port: "5555" },
  });
  const watchedIp = useWatch({
    control: wirelessForm.control,
    name: "ip",
    defaultValue: "",
  });

  const refreshDevices = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.allDevices() });
  }, [queryClient]);

  const refreshInfo = useCallback(async () => {
    if (!selectedSerial) {
      setDeviceInfo(null);
      return;
    }

    setIsRefreshingInfo(true);
    try {
      debugLog("Refreshing device info");
      const result = await GetDeviceInfo(selectedSerial);
      setDeviceInfo(result);
      debugLog("Device info refreshed:", result);
    } catch (error) {
      handleError("Refresh Device Info", error);
      setDeviceInfo(null);
    } finally {
      setIsRefreshingInfo(false);
    }
  }, [selectedSerial, setDeviceInfo]);

  useEffect(() => {
    if (activeView === "dashboard" && selectedSerial && !deviceInfo) {
      void refreshInfo();
    }
  }, [activeView, selectedSerial, deviceInfo, refreshInfo]);

  useEffect(() => {
    if (deviceInfo?.ipAddress && !deviceInfo.ipAddress.startsWith("N/A")) {
      wirelessForm.setValue("ip", deviceInfo.ipAddress, {
        shouldValidate: false,
      });
    }
  }, [deviceInfo?.ipAddress, wirelessForm]);

  const handleEnableTcpip = async () => {
    setIsEnablingTcpip(true);
    const toastId = toast.loading("Enabling wireless mode (port 5555)...", {
      description: "Please wait... Device must be connected via USB.",
    });
    try {
      debugLog("Enabling wireless ADB on port 5555");
      const output = await EnableWirelessAdb("5555", selectedSerial);
      toast.success("Wireless mode enabled!", {
        id: toastId,
        description: output,
      });
      handleSuccess("Wireless ADB", `Wireless mode enabled: ${output}`);
      refreshDevices();
    } catch (error) {
      toast.error("Failed to enable wireless mode", { id: toastId });
      handleError("Enable Wireless ADB", error);
    }
    setIsEnablingTcpip(false);
  };

  const handleConnect = async (values: WirelessAdbValues) => {
    setIsConnecting(true);
    const toastId = toast.loading(
      `Connecting to ${values.ip}:${values.port}...`
    );
    try {
      debugLog(`Connecting to ${values.ip}:${values.port}`);
      const output = await ConnectWirelessAdb(values.ip, values.port);
      toast.success("Connection successful!", {
        id: toastId,
        description: output,
      });
      handleSuccess(
        "Wireless ADB",
        `Connected to ${values.ip}:${values.port}: ${output}`
      );
      refreshDevices();
    } catch (error) {
      toast.error("Connection failed", { id: toastId });
      handleError("Wireless ADB Connect", error);
    }
    setIsConnecting(false);
  };

  const handleDisconnect = async () => {
    const values = wirelessForm.getValues();
    const parsed = wirelessAdbSchema.safeParse(values);
    if (!parsed.success) {
      toast.error("Invalid input", {
        description: parsed.error.issues[0]?.message ?? "Unknown error",
      });
      return;
    }
    setIsDisconnecting(true);
    const toastId = toast.loading(
      `Disconnecting from ${values.ip}:${values.port}...`
    );
    try {
      debugLog(`Disconnecting from ${values.ip}:${values.port}`);
      const output = await DisconnectWirelessAdb(values.ip, values.port);
      toast.success("Disconnected", { id: toastId, description: output });
      handleSuccess(
        "Wireless ADB",
        `Disconnected from ${values.ip}:${values.port}: ${output}`
      );
      refreshDevices();
    } catch (error) {
      toast.error("Disconnect failed", { id: toastId });
      handleError("Wireless ADB Disconnect", error);
    }
    setIsDisconnecting(false);
  };

  const openEditDialog = useCallback(
    (device: backend.Device) => {
      setEditingSerial(device.serial);
      setIsEditing(true);
    },
    [setEditingSerial, setIsEditing]
  );

  const handleNicknameSaved = useCallback(() => {
    refreshDevices();
  }, [refreshDevices]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Dashboard</h1>
      <ConnectedDevicesCard
        devices={queriedDevices.map((device) => ({
          serial: device.serial,
          status: device.status,
        }))}
        isLoading={false}
        onEdit={(serial) => {
          const device = queriedDevices.find((d) => d.serial === serial);
          if (device) {
            openEditDialog(device);
          }
        }}
        onRefresh={refreshDevices}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="size-5" />
            Wireless ADB Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="font-medium">Step 1: Enable (via USB)</p>
            <p className="text-muted-foreground text-sm">
              Make sure the device is connected with a USB cable, then click
              this button..
            </p>
            <Button
              className="h-auto w-full whitespace-normal"
              disabled={isEnablingTcpip || !selectedSerial || isConnecting}
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
                  <Field
                    data-invalid={Boolean(wirelessForm.formState.errors.ip)}
                  >
                    <FieldLabel htmlFor="dashboard-wireless-ip">
                      Device IP Address
                    </FieldLabel>
                    <Input
                      aria-describedby={
                        wirelessForm.formState.errors.ip
                          ? "ip-error"
                          : undefined
                      }
                      aria-invalid={Boolean(wirelessForm.formState.errors.ip)}
                      autoComplete="off"
                      id="dashboard-wireless-ip"
                      placeholder="Device IP Address"
                      {...wirelessForm.register("ip")}
                      disabled={isConnecting || isDisconnecting}
                    />
                    {wirelessForm.formState.errors.ip ? (
                      <FieldDescription
                        className="text-destructive"
                        id="ip-error"
                      >
                        {wirelessForm.formState.errors.ip.message}
                      </FieldDescription>
                    ) : null}
                  </Field>
                  <Field
                    data-invalid={Boolean(wirelessForm.formState.errors.port)}
                  >
                    <FieldLabel htmlFor="dashboard-wireless-port">
                      Wireless ADB Port
                    </FieldLabel>
                    <Input
                      aria-describedby={
                        wirelessForm.formState.errors.port
                          ? "port-error"
                          : undefined
                      }
                      aria-invalid={Boolean(wirelessForm.formState.errors.port)}
                      autoComplete="off"
                      id="dashboard-wireless-port"
                      inputMode="numeric"
                      placeholder="Port"
                      {...wirelessForm.register("port")}
                      disabled={isConnecting || isDisconnecting}
                    />
                    {wirelessForm.formState.errors.port ? (
                      <FieldDescription
                        className="text-destructive"
                        id="port-error"
                      >
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
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2">
            <Info className="size-5" />
            Device Info
          </CardTitle>
          <Button
            disabled={isRefreshingInfo || !selectedSerial}
            onClick={refreshInfo}
            variant="default"
          >
            {isRefreshingInfo ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Refresh Info
          </Button>
        </CardHeader>
        <CardContent>
          {selectedSerial ? (
            deviceInfo ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem
                  copyable
                  icon={<Building className="size-4" />}
                  label="Brand"
                  value={deviceInfo.brand}
                />
                <InfoItem
                  copyable
                  icon={<Tag className="size-4" />}
                  label="Device Name"
                  value={deviceInfo.deviceName}
                />
                <InfoItem
                  copyable
                  icon={<Code className="size-4" />}
                  label="Codename"
                  value={deviceInfo.codename}
                />
                <InfoItem
                  copyable
                  icon={<Smartphone className="size-4" />}
                  label="Model"
                  value={deviceInfo.model}
                />
                <InfoItem
                  copyable
                  icon={<Hash className="size-4" />}
                  label="Serial Number"
                  value={deviceInfo.serial}
                />
                <InfoItem
                  copyable
                  icon={<Server className="size-4" />}
                  label="Build Number"
                  value={deviceInfo.buildNumber}
                />
                <InfoItem
                  copyable
                  icon={<Info className="size-4" />}
                  label="Android Version"
                  value={deviceInfo.androidVersion}
                />
                <InfoItem
                  copyable
                  icon={<Battery className="size-4" />}
                  label="Battery"
                  value={deviceInfo.batteryLevel}
                />
                <InfoItem
                  copyable
                  icon={<Cpu className="size-4" />}
                  label="Total RAM"
                  value={deviceInfo.ramTotal}
                />
                <InfoItem
                  copyable
                  icon={<Database className="size-4" />}
                  label="Internal Storage"
                  value={deviceInfo.storageInfo}
                />
                <InfoItem
                  copyable
                  icon={<Wifi className="size-4" />}
                  label="IP Address"
                  value={deviceInfo.ipAddress}
                />
                <InfoItem
                  copyable
                  icon={<ShieldCheck className="size-4" />}
                  label="Root Status"
                  value={deviceInfo.rootStatus}
                  valueClassName={
                    deviceInfo.rootStatus === "Yes"
                      ? "text-success font-bold"
                      : "text-muted-foreground"
                  }
                />
              </div>
            ) : (
              <p className="text-muted-foreground">
                Click "Refresh Info" to load data.
              </p>
            )
          ) : (
            <p className="text-muted-foreground">
              Connect a device to see info.
            </p>
          )}
        </CardContent>
      </Card>

      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={(open) => {
          setIsEditing(open);
          if (!open) {
            setEditingSerial(null);
          }
        }}
        onSaved={handleNicknameSaved}
        serial={editingSerial}
      />
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  valueClassName,
  copyable = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  copyable?: boolean;
}) {
  return (
    <div className="group flex items-center gap-3 overflow-hidden rounded-lg bg-muted p-3">
      <div className="mr-3 shrink-0 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-muted-foreground text-sm">{label}</div>
        <div className={cn("truncate font-semibold", valueClassName)}>
          {value || "N/A"}
        </div>
      </div>
      {copyable && value ? (
        <CopyButton
          className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          label={label}
          value={value}
        />
      ) : null}
    </div>
  );
}
