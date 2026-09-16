import Sidebar from '@/src/components/custom/Sidebar';

function StatCard() {
  return (
    <div className="p-6 bg-white dark:bg-compass-bg border border-gray-200 dark:border-compass-border rounded-xl shadow-sm">
      <div className="flex justify-between mb-3">
        <div className="h-4 w-24 bg-gray-200 dark:bg-compass-border rounded animate-pulse" />
        <div className="h-5 w-5 bg-gray-200 dark:bg-compass-border rounded animate-pulse" />
      </div>
      <div className="h-8 w-20 bg-gray-200 dark:bg-compass-border rounded animate-pulse mb-1" />
      <div className="h-3 w-28 bg-gray-100 dark:bg-compass-border/50 rounded animate-pulse" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-6xl mx-auto">
          <div className="h-8 w-52 bg-gray-200 dark:bg-compass-border rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-gray-100 dark:bg-compass-border/50 rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => <StatCard key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-compass-bg border border-gray-200 dark:border-compass-border rounded-xl p-6 shadow-sm">
                <div className="h-6 w-36 bg-gray-200 dark:bg-compass-border rounded animate-pulse mb-6" />
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="flex justify-between py-2 border-b border-gray-50 dark:border-compass-border">
                      <div className="h-4 w-28 bg-gray-200 dark:bg-compass-border rounded animate-pulse" />
                      <div className="h-4 w-16 bg-gray-200 dark:bg-compass-border rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
