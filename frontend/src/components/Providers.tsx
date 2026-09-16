'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { ToastProvider } from '@/src/components/ui/toast';

export default function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Avoid unnecessary refetches on mobile (users switch tabs/apps often)
        staleTime:            30_000,  // 30s before data is considered stale
        refetchOnWindowFocus: false,   // don't refetch when user switches back to tab
        refetchOnReconnect:   true,    // DO refetch when coming back online
        retry:                1,
        retryDelay:           1_000,
      },
      mutations: {
        retry: 0, // never retry mutations — delete/update must not run twice
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem enableColorScheme={false} disableTransitionOnChange nonce={nonce}>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
