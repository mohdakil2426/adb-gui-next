import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Box,
  FolderOpen,
  Info,
  LayoutDashboard,
  Package,
  Settings,
  Store,
  Zap,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/shared/ui/sidebar';

type ViewType =
  | 'dashboard'
  | 'apps'
  | 'files'
  | 'marketplace'
  | 'flasher'
  | 'utils'
  | 'payload'
  | 'emulator'
  | 'about';

interface NavItem {
  icon: LucideIcon;
  id: ViewType;
  label: string;
}

interface NavGroup {
  items: NavItem[];
  label: string;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'apps', icon: Box, label: 'Applications' },
      { id: 'files', icon: FolderOpen, label: 'File Explorer' },
      { id: 'marketplace', icon: Store, label: 'Marketplace' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { id: 'flasher', icon: Zap, label: 'Flasher' },
      { id: 'utils', icon: Settings, label: 'Utilities' },
      { id: 'emulator', icon: Bot, label: 'Emulator' },
      { id: 'payload', icon: Package, label: 'Dumper' },
    ],
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function AppSidebar({ activeView, onViewChange, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="pointer-events-none" size="lg">
              <img
                alt="Logo"
                className="size-8 shrink-0 object-contain"
                height={32}
                src="/logo.png"
                width={32}
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">ADB GUI Next</span>
                <span className="truncate text-sidebar-foreground/70 text-xs">Desktop Toolkit</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      aria-current={activeView === item.id ? 'page' : undefined}
                      isActive={activeView === item.id}
                      onClick={() => {
                        onViewChange(item.id);
                      }}
                      tooltip={item.label}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-current={activeView === 'about' ? 'page' : undefined}
              isActive={activeView === 'about'}
              onClick={() => {
                onViewChange('about');
              }}
              tooltip="About"
            >
              <Info aria-hidden="true" />
              <span>About</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
