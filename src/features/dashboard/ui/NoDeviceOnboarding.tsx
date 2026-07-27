import { ExternalLink, RefreshCw, Smartphone, Wifi } from 'lucide-react';
import { BrowserOpenURL } from '@/desktop/runtime';
import type { WirelessAdbController } from '@/features/dashboard/hooks/useWirelessAdb';
import { WirelessAdbPanel } from '@/features/dashboard/ui/WirelessAdbPanel';
import { Button } from '@/shared/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';

interface NoDeviceOnboardingProps {
  isScanning: boolean;
  onScanAgain: () => void;
  onToggleWireless: () => void;
  showWireless: boolean;
  wireless: WirelessAdbController;
}

const ADB_DOCS_URL = 'https://developer.android.com/tools/adb';

const STEPS = [
  {
    body: 'Settings → About phone → tap Build number seven times.',
    title: 'Enable Developer options',
  },
  {
    body: 'Settings → System → Developer options → USB debugging.',
    title: 'Turn on USB debugging',
  },
  {
    body: 'Plug in the cable, then approve this computer on the device.',
    title: 'Accept the RSA prompt',
  },
] as const;

/**
 * First-run screen. Previously the Dashboard with no device was a set of empty
 * cards and disabled buttons, which explained nothing — this states the three
 * things the device must be told, and keeps both recovery paths one click away.
 */
export function NoDeviceOnboarding({
  isScanning,
  onScanAgain,
  onToggleWireless,
  showWireless,
  wireless,
}: NoDeviceOnboardingProps) {
  return (
    <div className="@container flex flex-col gap-4">
      <Empty className="rounded-lg border border-border border-dashed bg-surface">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Smartphone aria-hidden="true" className="animate-pulse" />
          </EmptyMedia>
          <EmptyTitle>No device connected</EmptyTitle>
          <EmptyDescription>
            Connect an Android device over USB, or pair one wirelessly.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent className="max-w-3xl gap-5">
          {/* Container query, not `sm:` — the window is never below 1024px, so a
              viewport breakpoint here could never evaluate false. What actually
              varies is this card's own width as the sidebar collapses. */}
          <ol className="grid w-full @xl:grid-cols-3 grid-cols-1 gap-3 text-left">
            {STEPS.map((step, index) => (
              <li
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised p-3"
                key={step.title}
              >
                <span className="numeric flex size-5 items-center justify-center rounded-full bg-primary-muted text-caption text-primary">
                  {index + 1}
                </span>
                <span className="font-medium text-body text-foreground">{step.title}</span>
                <span className="text-caption text-muted-foreground">{step.body}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={onToggleWireless} size="sm" type="button">
              <Wifi aria-hidden="true" />
              {showWireless ? 'Hide wireless pairing' : 'Connect wirelessly'}
            </Button>
            <Button
              disabled={isScanning}
              onClick={onScanAgain}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className={isScanning ? 'animate-spin' : undefined} />
              Scan again
            </Button>
            <Button
              onClick={() => {
                BrowserOpenURL(ADB_DOCS_URL);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ExternalLink aria-hidden="true" />
              Troubleshoot
            </Button>
          </div>

          <output
            aria-live="polite"
            className="flex items-center gap-2 text-caption text-muted-foreground"
          >
            <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-primary" />
            {isScanning ? 'Scanning for devices…' : 'Watching for devices…'}
          </output>
        </EmptyContent>
      </Empty>

      {showWireless ? (
        <WirelessAdbPanel isConnected={false} showEnableStep={false} wireless={wireless} />
      ) : null}
    </div>
  );
}
