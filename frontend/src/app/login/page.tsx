'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/ui/button';
import { Input  } from '@/src/components/ui/input';
import { Label  } from '@/src/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Loader2, Lock } from 'lucide-react';

export default function LoginPage() {
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setRetryAfter(null);

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json();
        if (res.status === 429) {
          const retry = parseInt(res.headers.get('Retry-After') ?? '60');
          setRetryAfter(retry);
          setError(data.error ?? 'Too many attempts. Please wait.');
        } else {
          setError(data.error ?? 'Login failed');
        }
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-md shadow-xl border-gray-200 dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="mb-4 flex flex-col items-center gap-3">
            <img
              src="/web-app-manifest-192x192.png"
              alt="MongoGUI logo"
              className="h-20 w-20 rounded-3xl shadow-lg shadow-emerald-950/20"
            />
          </div>
          <CardTitle className="text-3xl font-bold dark:text-gray-100">MongoGUI</CardTitle>
          <CardDescription className="text-center dark:text-gray-400">
            Open-source MongoDB Web GUI
            <br />
            <span className="text-xs text-amber-600 dark:text-amber-500 font-medium">
              Hint: Check your server console for the auto-generated password.
            </span>
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                <Lock size={16} />
                {error}
                {retryAfter && <span className="ml-1">({retryAfter}s)</span>}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username" className="dark:text-gray-300">Username</Label>
              <Input
                id="username" type="text" placeholder="admin"
                value={username} onChange={e => setUsername(e.target.value)} required
                autoComplete="username"
                className="dark:bg-slate-900 dark:border-slate-800 dark:text-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="dark:text-gray-300">Password</Label>
              <Input
                id="password" type="password"
                value={password} onChange={e => setPassword(e.target.value)} required
                autoComplete="current-password"
                className="dark:bg-slate-900 dark:border-slate-800 dark:text-gray-100"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading || retryAfter !== null}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
