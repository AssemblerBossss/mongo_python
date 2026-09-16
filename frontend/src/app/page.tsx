"use client";

import Sidebar from "@/src/components/custom/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { Database, Layers, Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";

// Skeleton card shown while stats load — prevents layout shift (CLS = 0)
function StatCard({
  title,
  icon: Icon,
  value,
  isLoading,
  iconClass,
}: {
  title: string;
  icon: React.ElementType;
  value: React.ReactNode;
  isLoading: boolean;
  iconClass: string;
}) {
  return (
    <div className="p-6 bg-white dark:bg-compass-bg rounded-xl border border-gray-200 dark:border-compass-border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-600 dark:text-compass-muted">{title}</h3>
        <Icon className={`w-5 h-5 ${iconClass}`} />
      </div>
      {isLoading ? (
        // Fixed-height skeleton so the card doesn't jump when data arrives
        <div className="h-9 w-16 bg-gray-200 dark:bg-compass-border rounded animate-pulse" />
      ) : (
        value
      )}
    </div>
  );
}

export default function Home() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    // Keep previous data visible while revalidating — no flash of empty state
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-compass-text">Dashboard</h1>
            <p className="text-gray-500 dark:text-compass-muted mt-2">
              Welcome to your MongoDB management interface.
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <StatCard
              title="Total Databases"
              icon={Database}
              iconClass="text-blue-600 dark:text-blue-500"
              isLoading={isLoading}
              value={
                <p className="text-3xl font-bold text-gray-900 dark:text-compass-text">
                  {stats?.dbCount ?? 0}
                </p>
              }
            />
            <StatCard
              title="Total Collections"
              icon={Layers}
              iconClass="text-purple-600 dark:text-purple-500"
              isLoading={isLoading}
              value={
                <p className="text-3xl font-bold text-gray-900 dark:text-compass-text">
                  {stats?.collectionCount ?? 0}
                </p>
              }
            />
            <StatCard
              title="Server Status"
              icon={Activity}
              iconClass="text-compass-green"
              isLoading={isLoading}
              value={
                <p className={
                  stats?.status === "online"
                    ? "text-emerald-600 dark:text-compass-green font-bold text-xl"
                    : "text-red-600 dark:text-red-400 font-bold text-xl"
                }>
                  {stats?.status === "online" ? "Online" : "Offline"}
                </p>
              }
            />
          </div>

          {error && (
            <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-400">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Connection Error</h3>
                  <p className="text-sm opacity-90 mb-4">
                    Could not connect to MongoDB. Check your <code>MONGODB_URI</code> in <code>.env</code>.
                  </p>
                  <div className="flex gap-3">
                    <Link href="/connections">
                      <Button className="bg-amber-600 hover:bg-amber-700 text-white border-none">
                        Configure Connection
                      </Button>
                    </Link>
                    <Button variant="outline" onClick={() => window.location.reload()}
                      className="border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}