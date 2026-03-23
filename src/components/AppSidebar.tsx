import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Box, FolderOpen, Zap, Settings, Info, Package } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { ThemeToggle } from './ThemeToggle';

type ViewType = 'dashboard' | 'apps' | 'files' | 'flasher' | 'utils' | 'payload' | 'about';

interface NavItem {
  id: ViewType;
  icon: LucideIcon;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'apps', icon: Box, label: 'Applications' },
      { id: 'files', icon: FolderOpen, label: 'File Explorer' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { id: 'flasher', icon: Zap, label: 'Flasher' },
      { id: 'utils', icon: Settings, label: 'Utilities' },
      { id: 'payload', icon: Package, label: 'Payload Dumper' },
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
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <img src="/logo.png" alt="Logo" className="size-5 object-contain" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">ADB GUI Next</span>
                <span className="truncate text-xs text-sidebar-foreground/70">Desktop Toolkit</span>
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
                      tooltip={item.label}
                      isActive={activeView === item.id}
                      onClick={() => onViewChange(item.id)}
                    >
                      <item.icon />
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
              tooltip="About"
              isActive={activeView === 'about'}
              onClick={() => onViewChange('about')}
            >
              <Info />
              <span>About</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
