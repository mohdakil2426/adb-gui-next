import { ChevronsUpDown, Smartphone, TriangleAlert } from 'lucide-react';
import { VIEW_PRELOADERS, VIEWS, type ViewType } from '@/app/shell/viewConfig';
import { NAV_SECTIONS, VIEW_META } from '@/shared/commands/navigation';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useNickname } from '@/shared/stores/nicknameStore';
import { useViewActivityCount } from '@/shared/stores/operationStore';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/shared/ui/sidebar';
import { cn } from '@/shared/utils/cn';

const STATUS_DOT: Record<string, string> = {
  device: 'bg-success',
  recovery: 'bg-info',
  sideload: 'bg-info',
  fastboot: 'bg-warning',
  bootloader: 'bg-warning',
  unauthorized: 'bg-destructive',
  offline: 'bg-foreground-subtle',
};

interface SidebarDeviceCardProps {
  onOpenDevicePicker: () => void;
}

/**
 * Device identity as a first-class citizen.
 *
 * Device state is the app's most important global value; a 120px-truncated pill
 * in the header under-served it. Every field subscribes narrowly so a device
 * poll does not re-render the navigation.
 */
function SidebarDeviceCard({ onOpenDevicePicker }: SidebarDeviceCardProps) {
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const status = useDeviceStore(
    (state) =>
      state.devices.find((device) => device.serial === state.selectedSerial)?.status ?? null,
  );
  const modelName = useDeviceStore((state) => state.deviceInfo?.deviceName || null);
  const androidVersion = useDeviceStore((state) => state.deviceInfo?.androidVersion || null);
  const nickname = useNickname(selectedSerial);

  const primary = nickname ?? modelName ?? selectedSerial ?? 'No device connected';
  const details: string[] = [];
  if (status) {
    details.push(status);
  }
  if (androidVersion) {
    details.push(`Android ${androidVersion}`);
  }
  const secondary = selectedSerial
    ? details.join(' · ') || selectedSerial
    : 'Search devices and actions';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label={`Current device: ${primary}. Click to select device or view actions.`}
          className="h-auto gap-2.5 border border-sidebar-border bg-sidebar-accent/50 py-1.5"
          onClick={onOpenDevicePicker}
          size="lg"
          tooltip={`${primary} — ${secondary}`}
        >
          <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-raised">
            <Smartphone aria-hidden="true" className="size-3.5" />
            <span
              aria-hidden="true"
              className={cn(
                'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-sidebar',
                (status && STATUS_DOT[status.toLowerCase()]) ?? 'bg-foreground-subtle',
              )}
            />
          </span>
          <span className="grid min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium text-body">{primary}</span>
            <span className="truncate text-caption text-muted-foreground">{secondary}</span>
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className="shrink-0 opacity-60 group-data-[collapsible=icon]:hidden"
          />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Activity marker: a pulse for one operation, a count for several. */
function NavActivityBadge({ view }: { view: ViewType }) {
  const count = useViewActivityCount(view);

  if (count === 0) {
    return null;
  }

  return (
    <SidebarMenuBadge className="text-primary">
      {count > 1 ? (
        <span className="numeric">{count}</span>
      ) : (
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-primary" />
      )}
      <span className="sr-only">{`${count} running operation${count === 1 ? '' : 's'}`}</span>
    </SidebarMenuBadge>
  );
}

interface NavButtonProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  view: ViewType;
}

function NavButton({ activeView, onViewChange, view }: NavButtonProps) {
  const meta = VIEW_META[view];
  const isActive = activeView === view;
  // Warm the lazy chunk before the click lands — hover and focus both count.
  const preload = VIEW_PRELOADERS[view];

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-current={isActive ? 'page' : undefined}
        isActive={isActive}
        onClick={() => {
          onViewChange(view);
        }}
        onFocus={preload}
        onPointerEnter={preload}
        tooltip={meta.title}
      >
        <meta.icon aria-hidden="true" />
        <span>{meta.title}</span>
      </SidebarMenuButton>
      <NavActivityBadge view={view} />
    </SidebarMenuItem>
  );
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeView: ViewType;
  onOpenDevicePicker: () => void;
  onViewChange: (view: ViewType) => void;
}

export function AppSidebar({
  activeView,
  onOpenDevicePicker,
  onViewChange,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-2">
        {/* Brand is a readout, not a control — it used to be a `pointer-events-none`
            menu button that still looked clickable. */}
        <div className="flex items-center justify-between px-1 py-0.5">
          <div className="flex items-center gap-2">
            <img
              alt=""
              aria-hidden="true"
              className="size-6 shrink-0 object-contain"
              height={24}
              src="/logo.png"
              width={24}
            />
            <span className="grid min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold text-body">ADB GUI Next</span>
              <span className="truncate text-caption text-muted-foreground">Desktop toolkit</span>
            </span>
          </div>
          <SidebarTrigger aria-label="Toggle mobile navigation" className="md:hidden" />
        </div>
        <SidebarDeviceCard onOpenDevicePicker={onOpenDevicePicker} />
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel
              className={cn('uppercase', section.risk && 'text-warning')}
              title={
                section.risk
                  ? 'Destructive operations — these can leave a device unbootable'
                  : undefined
              }
            >
              {section.label}
              {section.risk ? (
                <>
                  <TriangleAlert aria-hidden="true" className="ml-1.5 size-3" />
                  <span className="sr-only">— destructive operations</span>
                </>
              ) : null}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((view) => (
                  <NavButton
                    activeView={activeView}
                    key={view}
                    onViewChange={onViewChange}
                    view={view}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <NavButton activeView={activeView} onViewChange={onViewChange} view={VIEWS.ABOUT} />
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
