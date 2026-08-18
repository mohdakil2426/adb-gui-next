import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useEffect } from 'react';
import { MainLayout } from '@/app/shell/MainLayout';
import { ScrcpyFloatingToolbar } from '@/features/scrcpy/toolbar/ScrcpyFloatingToolbar';
import { Toaster } from '@/shared/ui/sonner';
import { STALE_TIME } from '@/shared/utils/queries';

const isToolbarWindow =
  typeof window !== 'undefined' &&
  (window.location.search.includes('window=scrcpy-toolbar') ||
    window.location.hash.includes('scrcpy-toolbar'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Every query here spawns an adb/fastboot/emulator subprocess. `staleTime: 0`
      // (the library default) combined with the default `refetchOnWindowFocus` meant
      // every alt-tab re-ran every mounted query. Queries that genuinely need to be
      // fresher opt in with their own `staleTime` / `refetchInterval`.
      staleTime: STALE_TIME.DEFAULT,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // A failed adb call is almost always a real condition (no device, unauthorized,
      // offline) rather than a transient fault, so retrying just doubles the latency
      // before the user sees the error.
      retry: false,
    },
  },
});

function ToolbarWindowContainer() {
  useEffect(() => {
    document.documentElement.classList.add('toolbar-window');
    document.body.classList.add('toolbar-window');
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <div className="flex h-screen w-screen items-start justify-start overflow-visible bg-transparent p-0">
          <ScrcpyFloatingToolbar />
          <Toaster position="bottom-right" richColors />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default function App() {
  if (isToolbarWindow) {
    return <ToolbarWindowContainer />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout />
    </QueryClientProvider>
  );
}
