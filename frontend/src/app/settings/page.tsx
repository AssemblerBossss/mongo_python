'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/src/components/custom/Sidebar';
import { Button } from '@/src/components/ui/button';
import { Input  } from '@/src/components/ui/input';
import { Label  } from '@/src/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/src/components/ui/card';
import { Lock, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [isLoading,        setIsLoading]        = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const router = useRouter();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setStatus({ type: 'error', message: 'New password must be at least 8 characters' });
      return;
    }

    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/change-password', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: 'Password updated! Redirecting to login...' });
        setTimeout(() => { router.push('/login'); router.refresh(); }, 2000);
      } else {
        setStatus({ type: 'error', message: data.error ?? 'Failed to change password' });
      }
    } catch {
      setStatus({ type: 'error', message: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-compass-text">Settings</h1>
            <p className="text-gray-500 dark:text-compass-muted mt-2">Manage your account security and preferences.</p>
          </header>

          <Card className="border-gray-200 dark:border-compass-border shadow-sm dark:bg-compass-bg">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                  <ShieldCheck size={20} />
                </div>
                <CardTitle className="dark:text-compass-text">Change Password</CardTitle>
              </div>
              <CardDescription className="dark:text-compass-muted">
                Update your administrator password. You will be logged out after a successful change.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleChangePassword}>
              <CardContent className="space-y-4">
                {status && (
                  <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                    status.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400'
                  }`}>
                    {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {status.message}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="dark:text-compass-muted">Current Password</Label>
                  <div className="relative">
                    <Input id="currentPassword" type="password" value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)} required
                      autoComplete="current-password"
                      className="pl-9 dark:bg-compass-bg dark:border-compass-border dark:text-compass-text" />
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="dark:text-compass-muted">New Password</Label>
                  <div className="relative">
                    <Input id="newPassword" type="password" value={newPassword}
                      onChange={e => setNewPassword(e.target.value)} required minLength={8}
                      autoComplete="new-password"
                      className="pl-9 dark:bg-compass-bg dark:border-compass-border dark:text-compass-text" />
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="dark:text-compass-muted">Confirm New Password</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type="password" value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)} required
                      autoComplete="new-password"
                      className="pl-9 dark:bg-compass-bg dark:border-compass-border dark:text-compass-text" />
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t dark:border-compass-border pt-6">
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  Update Password
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
