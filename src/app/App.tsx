import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from '@/app/shell/MainLayout';
import { STALE_TIME } from '@/shared/utils/queries';

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout />
    </QueryClientProvider>
  );
}
