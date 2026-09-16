import ConnectionForm from "@/src/components/custom/ConnectionForm";
import Sidebar from "@/src/components/custom/Sidebar";

export default function ConnectionsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-compass-text">Connections</h1>
            <p className="text-gray-500 dark:text-compass-muted mt-2">Manage your MongoDB server connections.</p>
          </header>
          
          <div className="mt-8">
            <ConnectionForm />
          </div>
        </div>
      </main>
    </div>
  );
}
