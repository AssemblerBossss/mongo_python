export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-compass-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 dark:border-compass-green border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-compass-muted animate-pulse">Loading…</p>
      </div>
    </div>
  );
}
