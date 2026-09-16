'use client';

import { useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-compass-bg p-4">
      <div className="max-w-md w-full bg-white dark:bg-compass-bg border border-red-200 dark:border-red-900 rounded-2xl p-8 text-center shadow-lg">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-full">
            <AlertTriangle className="text-red-600 dark:text-red-400" size={28} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-compass-text mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 dark:text-compass-muted mb-6">
          {error.message ?? 'An unexpected error occurred.'}
        </p>
        <Button onClick={reset} className="w-full">Try again</Button>
      </div>
    </div>
  );
}
