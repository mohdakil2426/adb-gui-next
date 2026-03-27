import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLogStore } from '@/lib/logStore';
import { useDeviceStore } from '@/lib/deviceStore';
import { handleError } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import { cn, getFileName } from '@/lib/utils';
import { partitionSchema } from '@/lib/schemas';
import { OnFileDrop, OnFileDropOff } from '@/lib/desktop/runtime';

import {
  WipeData,
  FlashPartition,
  SelectImageFile,
  SelectZipFile,
  SideloadPackage,
} from '@/lib/desktop/backend';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { buttonVariants } from '@/components/ui/button-variants';
import { FileSelector } from '@/components/FileSelector';
import { toast } from 'sonner';
import {
  Loader2,
  AlertTriangle,
  FileUp,
  Trash2,
  Package,
  HardDrive,
  Upload,
  X,
} from 'lucide-react';

/**
 * Common Android partition names shown as datalist suggestions.
 * Users can still type any partition name — this just aids discovery.
 */
const COMMON_PARTITIONS = [
  'boot',
  'vendor_boot',
  'init_boot',
  'recovery',
  'dtbo',
  'vbmeta',
  'vbmeta_system',
  'vbmeta_vendor',
  'system',
  'vendor',
  'product',
  'system_ext',
  'super',
  'modem',
  'radio',
  'persist',
  'metadata',
  'cache',
  'userdata',
] as const;

// ─── Visual-only drop area (no event listeners — page-level handler routes) ──

interface DropAreaProps {
  isDragging: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  browseLabel: string;
  onBrowse: () => void;
  disabled?: boolean;
}

function DropArea({
  isDragging,
  icon: Icon,
  label,
  sublabel,
  browseLabel,
  onBrowse,
  disabled = false,
}: DropAreaProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all duration-200',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.01] shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.15)]'
          : 'border-muted-foreground/25 hover:border-muted-foreground/40',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {/* Drag-over overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2 text-primary animate-in fade-in zoom-in-95 duration-150">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="size-8 animate-bounce" />
            </div>
            <p className="text-sm font-semibold">Drop to add file</p>
          </div>
        </div>
      )}

      {/* Default state */}
      <div
        className={cn(
          'flex flex-col items-center gap-3 transition-opacity duration-150',
          isDragging && 'opacity-0',
        )}
      >
        <div className="rounded-full bg-muted p-3">
          <Icon className="size-6 text-muted-foreground/50" />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground/50">or</p>
        </div>

        <Button variant="outline" size="sm" onClick={onBrowse} disabled={disabled}>
          {browseLabel}
        </Button>

        <p className="text-xs text-muted-foreground/40">{sublabel}</p>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ViewFlasher({ activeView: _activeView }: { activeView: string }) {
  const [partition, setPartition] = useState('');
  const [filePath, setFilePath] = useState('');
  const [sideloadFilePath, setSideloadFilePath] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { devices } = useDeviceStore();

  const hasFastbootDevice = useMemo(
    () => devices.some((d) => d.status === 'fastboot' || d.status === 'bootloader'),
    [devices],
  );

  const hasSideloadDevice = useMemo(
    () => devices.some((d) => d.status === 'sideload' || d.status === 'recovery'),
    [devices],
  );

  const isGlobalLoading = !!loadingAction;

  // ─── Page-level drag-drop handler — routes files by extension ────

  useEffect(() => {
    OnFileDrop({
      onHover: () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsDragging(true);
        hoverTimeoutRef.current = setTimeout(() => setIsDragging(false), 150);
      },

      onDrop: (paths) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsDragging(false);

        for (const p of paths) {
          const lower = p.toLowerCase();
          if (lower.endsWith('.img')) {
            setFilePath(p);
            toast.info(`Image selected: ${getFileName(p)}`);
          } else if (lower.endsWith('.zip')) {
            setSideloadFilePath(p);
            toast.info(`ZIP selected: ${getFileName(p)}`);
          } else {
            toast.error('Unsupported file type', {
              description: 'Only .img and .zip files are accepted.',
            });
          }
        }
      },

      onCancel: () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsDragging(false);
      },
    });

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      OnFileDropOff();
    };
  }, []);

  // ─── File selection handlers ────────────────────────────────────────

  const handleSelectImageFile = useCallback(async () => {
    try {
      debugLog('Selecting image file');
      const selected = await SelectImageFile();
      if (selected) {
        setFilePath(selected);
        toast.info(`File selected: ${getFileName(selected)}`);
      }
    } catch (error) {
      handleError('Select Image File', error);
    }
  }, []);

  const handleSelectSideloadFile = useCallback(async () => {
    try {
      debugLog('Selecting ZIP file for sideload');
      const selected = await SelectZipFile();
      if (selected) {
        setSideloadFilePath(selected);
        toast.info(`ZIP selected: ${getFileName(selected)}`);
      }
    } catch (error) {
      handleError('Select ZIP File', error);
    }
  }, []);

  // ─── Action handlers ───────────────────────────────────────────────

  const handleFlash = async () => {
    const parsed = partitionSchema.safeParse(partition);
    if (!parsed.success) {
      toast.error('Invalid partition name', { description: parsed.error.issues[0].message });
      return;
    }
    if (!filePath) {
      toast.error('No file selected.');
      return;
    }

    setLoadingAction('flash');
    const toastId = toast.loading(`Flashing ${partition} partition...`);

    try {
      await FlashPartition(partition, filePath);
      toast.success('Flash Complete', {
        description: `${partition} flashed successfully.`,
        id: toastId,
      });
      useLogStore.getState().addLog(`Flashed partition ${partition}: Success`, 'success');
    } catch (error) {
      toast.dismiss(toastId);
      handleError('Flash Partition', error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSideload = async () => {
    if (!sideloadFilePath) {
      toast.error('No update package selected.');
      return;
    }

    const fileName = getFileName(sideloadFilePath);
    setLoadingAction('sideload');
    const toastId = toast.loading(`Sideloading ${fileName}...`);

    try {
      const output = await SideloadPackage(sideloadFilePath);
      const description = output || `${fileName} sideloaded successfully.`;
      toast.success('Sideload Complete', { description, id: toastId });
      useLogStore.getState().addLog(`Sideloaded ${fileName}: ${description}`, 'success');
    } catch (error) {
      toast.dismiss(toastId);
      handleError('Recovery Sideload', error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWipe = async () => {
    setLoadingAction('wipe');
    const toastId = toast.loading('Wiping data... Device will factory reset.');

    try {
      await WipeData();
      toast.success('Wipe Complete', { description: 'Device data has been erased.', id: toastId });
      useLogStore.getState().addLog('Device data wiped (Factory Reset): Success', 'success');
    } catch (error) {
      toast.dismiss(toastId);
      handleError('Wipe Data', error);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Flash Partition ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Flash Partition
          </CardTitle>
          <CardDescription>Flash an image file to a device partition via fastboot.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Partition name with datalist suggestions */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="flasher-partition">Partition Name</Label>
            <Input
              id="flasher-partition"
              list="partition-suggestions"
              placeholder="e.g., boot, recovery, vendor_boot"
              value={partition}
              onChange={(e) => setPartition(e.target.value)}
              disabled={isGlobalLoading}
            />
            <datalist id="partition-suggestions">
              {COMMON_PARTITIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          {/* Image file: DropArea when empty, FileSelector when populated */}
          {!filePath ? (
            <DropArea
              isDragging={isDragging}
              icon={FileUp}
              label="Drop an image file here"
              sublabel="Accepted: .img files"
              browseLabel="Browse Image"
              onBrowse={handleSelectImageFile}
              disabled={isGlobalLoading}
            />
          ) : (
            <FileSelector
              label="Image File"
              path={filePath}
              onSelect={handleSelectImageFile}
              icon={<FileUp className="h-4 w-4" />}
              disabled={isGlobalLoading}
              trailingAction={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setFilePath('')}
                      disabled={isGlobalLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear selection</TooltipContent>
                </Tooltip>
              }
            />
          )}

          <Button
            className="w-full"
            disabled={isGlobalLoading || !partition || !filePath || !hasFastbootDevice}
            onClick={handleFlash}
          >
            {loadingAction === 'flash' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
            ) : (
              <FileUp className="mr-2 h-4 w-4 shrink-0" />
            )}
            Flash Partition
          </Button>
        </CardContent>
      </Card>

      {/* ── Recovery Sideload ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Recovery Sideload
          </CardTitle>
          <CardDescription>
            Send a flashable ZIP via adb sideload while your device is in recovery.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Sideload file: DropArea when empty, FileSelector when populated */}
          {!sideloadFilePath ? (
            <DropArea
              isDragging={isDragging}
              icon={Package}
              label="Drop a flashable ZIP here"
              sublabel="Accepted: .zip files"
              browseLabel="Browse ZIP"
              onBrowse={handleSelectSideloadFile}
              disabled={isGlobalLoading}
            />
          ) : (
            <FileSelector
              label="Flashable ZIP"
              path={sideloadFilePath}
              onSelect={handleSelectSideloadFile}
              placeholder="Select a flashable .zip file..."
              icon={<Package className="h-4 w-4" />}
              disabled={isGlobalLoading}
              trailingAction={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSideloadFilePath('')}
                      disabled={isGlobalLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear selection</TooltipContent>
                </Tooltip>
              }
            />
          )}

          <p className="text-sm text-muted-foreground">
            Ensure the device shows &quot;sideload&quot; mode in recovery before starting.
          </p>

          <Button
            className="w-full"
            disabled={isGlobalLoading || !sideloadFilePath || !hasSideloadDevice}
            onClick={handleSideload}
          >
            {loadingAction === 'sideload' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
            ) : (
              <Package className="mr-2 h-4 w-4 shrink-0" />
            )}
            Sideload Package
          </Button>
        </CardContent>
      </Card>

      {/* ── Danger Zone ─────────────────────────────────────────────── */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            These actions are irreversible and will erase data on your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                disabled={isGlobalLoading || !hasFastbootDevice}
              >
                {loadingAction === 'wipe' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                )}
                Wipe Data (Factory Reset)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently erase all user data (photos,
                  files, settings) from your device, performing a full factory reset.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: 'destructive' })}
                  onClick={handleWipe}
                >
                  Yes, Wipe Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
