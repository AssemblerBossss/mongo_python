'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" className={cn('w-10 h-10 rounded-xl', className)}><div className="w-5 h-5" /></Button>;
  }

  const isDark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn('w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors', className)}
      title="Toggle theme"
    >
      {isDark
        ? <Sun  className="h-5 w-5 text-amber-400" />
        : <Moon className="h-5 w-5 text-slate-700" />}
    </Button>
  );
}
