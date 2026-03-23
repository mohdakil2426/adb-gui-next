import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { SidebarMenuButton } from '@/components/ui/sidebar';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <SidebarMenuButton tooltip="Theme" disabled>
        <Sun />
        <span>Loading...</span>
      </SidebarMenuButton>
    );
  }

  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <SidebarMenuButton tooltip={isDark ? 'Light Mode' : 'Dark Mode'} onClick={toggleTheme}>
      {isDark ? <Sun /> : <Moon />}
      <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </SidebarMenuButton>
  );
}
