import Sidebar from '@/src/components/custom/Sidebar.tsx';

export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-6xl mx-auto">
          <div className="h-4 w-36 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="h-8 w-56 bg-gray-200 rounded animate-pulse mb-6" />
          {/* Filter bar skeleton */}
          <div className="h-14 bg-white border border-gray-200 rounded-xl animate-pulse mb-6" />
          {/* Document cards skeleton */}
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                    <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 + i }).map((_, j) => (
                    <div key={j} className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
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
