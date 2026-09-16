'use client';

import { CheckCircle2, Info, X, XCircle, AlertTriangle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
};

type ToastInput = string | { title: string; description?: string };

type ToastContextValue = {
  success: (message: ToastInput) => void;
  error: (message: ToastInput) => void;
  warning: (message: ToastInput) => void;
  info: (message: ToastInput) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function normalize(message: ToastInput) {
  return typeof message === 'string' ? { title: message } : message;
}

function IconForType({ type }: { type: ToastType }) {
  if (type === 'success') return <CheckCircle2 size={18} />;
  if (type === 'error') return <XCircle size={18} />;
  if (type === 'warning') return <AlertTriangle size={18} />;
  return <Info size={18} />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const normalized = normalize(message);
    setToasts((items) => [{ id, type, ...normalized }, ...items].slice(0, 5));
    window.setTimeout(() => dismiss(id), type === 'error' ? 6500 : 4200);
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    warning: (message) => push('warning', message),
    info: (message) => push('info', message),
    dismiss,
  }), [dismiss, push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto overflow-hidden rounded-xl border bg-white p-4 shadow-2xl backdrop-blur dark:bg-compass-sidebar',
              'toast-enter',
              toast.type === 'success' && 'border-emerald-200 dark:border-emerald-800',
              toast.type === 'error' && 'border-red-200 dark:border-red-800',
              toast.type === 'warning' && 'border-amber-200 dark:border-amber-800',
              toast.type === 'info' && 'border-sky-200 dark:border-sky-800',
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'mt-0.5 rounded-lg p-1.5',
                toast.type === 'success' && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
                toast.type === 'error' && 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
                toast.type === 'warning' && 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
                toast.type === 'info' && 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
              )}>
                <IconForType type={toast.type} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-compass-text">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-sm text-gray-500 dark:text-compass-muted">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-compass-border/40 dark:hover:text-compass-text"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
