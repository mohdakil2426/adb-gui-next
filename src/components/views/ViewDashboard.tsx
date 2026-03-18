import React, { useState, useEffect } from 'react';

import { GetDevices, GetDeviceInfo, EnableWirelessAdb, ConnectWirelessAdb, DisconnectWirelessAdb } from '../../../wailsjs/go/backend/App';
import { backend } from '../../../wailsjs/go/models';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Battery, Info, Server, RefreshCw, Loader2, Hash, Wifi, ShieldCheck, Cpu, Database, Code, Building, Usb, PlugZap, Tag, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNickname, setNickname } from '@/lib/nicknameStore';
import { useLogStore } from '@/lib/logStore';
import { useDeviceStore } from '@/lib/deviceStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConnectedDevicesCard } from "@/components/ConnectedDevicesCard";
import { EditNicknameDialog } from "@/components/EditNicknameDialog";


type Device = backend.Device;
type DeviceInfo = backend.DeviceInfo;

export function ViewDashboard({ activeView }: { activeView: string }) {
  const { devices, setDevices, deviceInfo, setDeviceInfo } = useDeviceStore();
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [isRefreshingInfo, setIsRefreshingInfo] = useState(false);
  const [wirelessIp, setWirelessIp] = useState('');
  const [wirelessPort, setWirelessPort] = useState('5555');
  const [isEnablingTcpip, setIsEnablingTcpip] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [nicknameVersion, setNicknameVersion] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);

  const refreshDevices = async () => {
    setIsRefreshingDevices(true);
    try {
      const result = await GetDevices();
      setDevices(result || []);
    } catch (error) {
      console.error("Error refreshing devices:", error);
      setDevices([]);
    }
    setIsRefreshingDevices(false);
  };

  const refreshInfo = async () => {
    if (devices.length === 0) {
      setDeviceInfo(null);
      return;
    }

    setIsRefreshingInfo(true);
    try {
      const result = await GetDeviceInfo();
      setDeviceInfo(result);
    } catch (error) {
      console.error("Error refreshing device info:", error);
      setDeviceInfo(null);
    }
    setIsRefreshingInfo(false);
  };

  useEffect(() => {
    if (activeView === 'dashboard') {
      refreshDevices();
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView === 'dashboard') {
      const interval = setInterval(() => {
        if (!isRefreshingDevices) {
          refreshDevices();
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [activeView, isRefreshingDevices]);

  useEffect(() => {
    if (deviceInfo?.ipAddress && !deviceInfo.ipAddress.startsWith("N/A")) {
      setWirelessIp(deviceInfo.ipAddress);
    }
  }, [deviceInfo?.ipAddress]);

  const handleEnableTcpip = async () => {
    setIsEnablingTcpip(true);
    const toastId = toast.loading("Enabling wireless mode (port 5555)...", {
      description: "Please wait... Device must be connected via USB.",
    });
    try {
      const output = await EnableWirelessAdb('5555');
      toast.success("Wireless mode enabled!", { id: toastId, description: output });
      useLogStore.getState().addLog(`Wireless mode enabled: ${output}`, 'success');
    } catch (error) {
      toast.error("Failed to enable wireless mode", { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Failed to enable wireless mode: ${error}`, 'error');
    }
    setIsEnablingTcpip(false);
  };

  const handleConnect = async () => {
    if (!wirelessIp) {
      toast.error("IP Address cannot be empty");
      return;
    }
    setIsConnecting(true);
    const toastId = toast.loading(`Connecting to ${wirelessIp}:${wirelessPort}...`);
    try {
      const output = await ConnectWirelessAdb(wirelessIp, wirelessPort);
      toast.success("Connection successful!", { id: toastId, description: output });
      useLogStore.getState().addLog(`Connected to ${wirelessIp}:${wirelessPort}: ${output}`, 'success');

      refreshDevices();
    } catch (error) {
      toast.error("Connection failed", { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Connection failed to ${wirelessIp}:${wirelessPort}: ${error}`, 'error');
    }
    setIsConnecting(false);
  };

  const handleDisconnect = async () => {
    if (!wirelessIp) {
      toast.error("IP Address cannot be empty");
      return;
    }
    setIsDisconnecting(true);
    const toastId = toast.loading(`Disconnecting from ${wirelessIp}:${wirelessPort}...`);
    try {
      const output = await DisconnectWirelessAdb(wirelessIp, wirelessPort);
      toast.success("Disconnected", { id: toastId, description: output });
      useLogStore.getState().addLog(`Disconnected from ${wirelessIp}:${wirelessPort}: ${output}`, 'info');

      refreshDevices();
    } catch (error) {
      toast.error("Disconnect failed", { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Disconnect failed from ${wirelessIp}:${wirelessPort}: ${error}`, 'error');
    }
    setIsDisconnecting(false);
  };

  const openEditDialog = (device: Device) => {
    setCurrentDevice(device);
    setIsEditing(true);
  };

  const handleNicknameSaved = () => {
    setNicknameVersion(v => v + 1); // Trigger re-render
  };

  return (
    <div className="flex flex-col gap-6">

      <ConnectedDevicesCard
        devices={devices.map(device => ({
          serial: device.serial,
          status: device.status
        }))}
        isLoading={isRefreshingDevices}
        onRefresh={refreshDevices}
        onEdit={(serial) => {
          const device = devices.find(d => d.serial === serial);
          if (device) openEditDialog(device);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi />
            Wireless ADB Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

          <div className="space-y-3">
            <p className="font-medium">Step 1: Enable (via USB)</p>
            <p className="text-sm text-muted-foreground">
              Make sure the device is connected with a USB cable, then click this button..
            </p>
            <Button
              className="w-full h-auto whitespace-normal"
              onClick={handleEnableTcpip}
              disabled={isEnablingTcpip || devices.length === 0 || isConnecting}
            >
              {isEnablingTcpip ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Usb className="mr-2 h-4 w-4 shrink-0" />
              )}
              Enable Wireless Mode (tcpip)
            </Button>
          </div>

          <div className="space-y-3">
            <p className="font-medium">Step 2: Connect (via WiFi)</p>
            <p className="text-sm text-muted-foreground">
              Enter the Device IP (usually automatically filled in) and Port.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Device IP Address"
                value={wirelessIp}
                onChange={(e) => setWirelessIp(e.target.value)}
                disabled={isConnecting || isDisconnecting}
                className="flex-1"
              />
              <Input
                placeholder="Port"
                value={wirelessPort}
                onChange={(e) => setWirelessPort(e.target.value)}
                disabled={isConnecting || isDisconnecting}
                className="w-24"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={handleConnect}
                disabled={isConnecting || !wirelessIp || isDisconnecting}
              >
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Wifi className="mr-2 h-4 w-4 shrink-0" />
                )}
                Connect
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDisconnect}
                disabled={isDisconnecting || !wirelessIp || isConnecting}
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <PlugZap className="mr-2 h-4 w-4 shrink-0" />
                )}
                Disconnect
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Info />
            Device Info
          </CardTitle>
          <Button
            variant="default"
            onClick={refreshInfo}
            disabled={isRefreshingInfo || devices.length === 0}
          >
            {isRefreshingInfo ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh Info
          </Button>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-muted-foreground">Connect a device to see info.</p>
          ) : !deviceInfo ? (
            <p className="text-muted-foreground">Click "Refresh Info" to load data.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              <InfoItem icon={<Building size={18} />} label="Brand" value={deviceInfo.brand} />
              <InfoItem icon={<Tag size={18} />} label="Device Name" value={deviceInfo.deviceName} />
              <InfoItem icon={<Code size={18} />} label="Codename" value={deviceInfo.codename} />
              <InfoItem icon={<Smartphone size={18} />} label="Model" value={deviceInfo.model} />
              <InfoItem icon={<Hash size={18} />} label="Serial Number" value={deviceInfo.serial} />
              <InfoItem icon={<Server size={18} />} label="Build Number" value={deviceInfo.buildNumber} />
              <InfoItem icon={<Info size={18} />} label="Android Version" value={deviceInfo.androidVersion} />
              <InfoItem icon={<Battery size={18} />} label="Battery" value={deviceInfo.batteryLevel} />
              <InfoItem icon={<Cpu size={18} />} label="Total RAM" value={deviceInfo.ramTotal} />
              <InfoItem icon={<Database size={18} />} label="Internal Storage" value={deviceInfo.storageInfo} />
              <InfoItem icon={<Wifi size={18} />} label="IP Address" value={deviceInfo.ipAddress} />
              <InfoItem icon={<ShieldCheck size={18} />} label="Root Status" value={deviceInfo.rootStatus}
                valueClassName={deviceInfo.rootStatus === 'Yes' ? 'text-green-500 font-bold' : 'text-muted-foreground'} />

            </div>
          )}
        </CardContent>
      </Card>

      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={setIsEditing}
        serial={currentDevice?.serial || null}
        onSaved={handleNicknameSaved}
      />
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  valueClassName
}: {
  icon: React.ReactNode,
  label: string,
  value: string,
  valueClassName?: string
}) {
  return (
    <div className="flex items-center p-3 bg-muted rounded-lg overflow-hidden">
      <div className="mr-3 text-primary shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground truncate" title={label}>{label}</div>
        <div className={cn("font-semibold truncate", valueClassName)} title={value}>
          {value ? value : "N/A"}
        </div>
      </div>
    </div>
  );
}
