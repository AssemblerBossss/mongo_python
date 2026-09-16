import Sidebar from '@/src/components/custom/Sidebar';

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 dark:border-compass-border">
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-compass-border rounded animate-pulse w-32" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-compass-border rounded animate-pulse w-16" /></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-compass-border rounded animate-pulse w-10" /></td>
      <td className="px-6 py-4"><div className="h-8 bg-gray-200 dark:bg-compass-border rounded animate-pulse w-28 ml-auto" /></td>
    </tr>
  );
}

export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-5xl mx-auto">
          <div className="h-8 w-40 bg-gray-200 dark:bg-compass-border rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-100 dark:bg-compass-border/50 rounded animate-pulse mb-8" />
          <div className="bg-white dark:bg-compass-bg border border-gray-200 dark:border-compass-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-compass-bg border-b border-gray-200 dark:border-compass-border">
                  {['Name', 'Size', 'Collections', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-4 text-left text-sm font-semibold text-gray-400 dark:text-compass-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
