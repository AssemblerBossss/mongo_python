import Sidebar from '@/src/components/custom/Sidebar';

export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-5xl mx-auto">
          <div className="h-4 w-32 bg-gray-200 dark:bg-compass-border rounded animate-pulse mb-4" />
          <div className="h-8 w-48 bg-gray-200 dark:bg-compass-border rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-6 bg-white dark:bg-compass-bg border border-gray-200 dark:border-compass-border rounded-xl shadow-sm">
                <div className="h-10 w-10 bg-gray-200 dark:bg-compass-border rounded-lg animate-pulse mb-4" />
                <div className="h-5 w-32 bg-gray-200 dark:bg-compass-border rounded animate-pulse mb-2" />
                <div className="h-3 w-20 bg-gray-100 dark:bg-compass-border/50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
