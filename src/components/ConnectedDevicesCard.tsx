import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, RefreshCw, Loader2, Pencil } from "lucide-react";
import { getNickname } from '@/lib/nicknameStore';

export interface DeviceData {
    serial: string;
    status: string;
}

interface ConnectedDevicesCardProps {
    devices: DeviceData[];
    isLoading: boolean;
    onRefresh: () => void;
    onEdit: (serial: string) => void;
    emptyText?: string;
    className?: string;
    isRefreshDisabled?: boolean;
}

export function ConnectedDevicesCard({
    devices,
    isLoading,
    onRefresh,
    onEdit,
    emptyText = "No device detected. Ensure USB Debugging is enabled.",
    className,
    isRefreshDisabled
}: ConnectedDevicesCardProps) {
    return (
        <Card className={className}>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Connected Devices
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading || isRefreshDisabled}>
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                </Button>
            </CardHeader>
            <CardContent>
                {devices.length === 0 ? (
                    <p className="text-muted-foreground">
                        {isLoading ? "Scanning for devices..." : emptyText}
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {devices.map((device) => {
                            const displayName = getNickname(device.serial) || device.serial;
                            const description = displayName !== device.serial ? device.serial : undefined;

                            let statusText = device.status;
                            let statusColor = 'text-yellow-500';

                            if (device.status === 'device') {
                                statusText = 'adb';
                                statusColor = 'text-green-500';
                            } else if (device.status === 'fastboot') {
                                statusText = 'fastboot';
                                statusColor = 'text-blue-500';
                            } else if (device.status === 'recovery') {
                                statusText = 'recovery';
                                // yellow is default
                            } else if (device.status === 'unauthorized') {
                                statusText = 'unauthorized';
                                statusColor = 'text-red-500';
                            } else {
                                statusText = device.status.toLowerCase();
                            }

                            return (
                                <div key={device.serial} className="flex items-center justify-between p-3 bg-muted rounded-lg group">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-lg">{displayName}</span>
                                        {description && (
                                            <span className="font-mono text-xs text-muted-foreground">{description}</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className={`font-semibold ${statusColor}`}>
                                            {statusText}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => onEdit(device.serial)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
