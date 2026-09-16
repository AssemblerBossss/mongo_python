"use client";

import { useState } from "react";
import { cn } from "@/src/lib/utils";
import Sidebar from "@/src/components/custom/Sidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Database, ExternalLink, HardDrive, Trash2, AlertTriangle, X, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export default function DatabasesPage() {
  const queryClient = useQueryClient();
  const [dbToDrop, setDbToDrop] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [isDropping, setIsDropping] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const { data: databases, isLoading, error } = useQuery({
    queryKey: ["databases"],
    queryFn: async () => {
      const res = await fetch("/api/databases");
      if (!res.ok) throw new Error("Failed to fetch databases");
      return res.json();
    },
  });

  const { data: appInfo } = useQuery({
    queryKey: ["app-info"],
    queryFn: async () => {
      const res = await fetch("/api/app");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch app mode");
      return json as { mode: "full" | "readonly"; readonly: boolean; systemDatabases: string[] };
    },
    staleTime: 60_000,
  });

  const isReadOnlyMode = appInfo?.readonly === true;
  const systemDatabases = appInfo?.systemDatabases ?? ["admin", "local", "config"];

  const handleDropDatabase = async () => {
    if (isReadOnlyMode || !dbToDrop || confirmName !== dbToDrop) return;

    setIsDropping(true);
    setDropError(null);

    try {
      const res = await fetch(`/api/databases/${dbToDrop}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to drop database");
      }

      await queryClient.invalidateQueries({ queryKey: ["databases"] });
      setDbToDrop(null);
      setConfirmName("");
    } catch (err: any) {
      setDropError(err.message);
    } finally {
      setIsDropping(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-compass-text">Databases</h1>
              <p className="text-gray-500 dark:text-compass-muted mt-2">Explore and manage your MongoDB databases.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-compass-muted bg-white dark:bg-compass-bg px-3 py-1 rounded-full border border-gray-200 dark:border-compass-border self-start sm:self-auto shadow-sm">
              <HardDrive size={14} />
              <span>{databases?.length ?? 0} Databases</span>
            </div>
          </header>

          {isReadOnlyMode && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <Lock size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Read-only mode enabled</p>
                <p className="text-sm opacity-90">Database drop actions are disabled in the UI and blocked by the API.</p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Loading databases...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-400">
              Error: {(error as Error).message}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white dark:bg-compass-bg border border-gray-200 dark:border-compass-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-compass-bg border-b border-gray-200 dark:border-compass-border">
                      <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-compass-muted">Name</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-compass-muted">Size on Disk</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-compass-muted">Collections</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-compass-muted text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-compass-border">
                    {databases?.map((db: any) => (
                      <tr key={db.name} className="hover:bg-gray-50 dark:hover:bg-compass-border/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg">
                              <Database size={18} />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-compass-text">{db.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-compass-muted">
                          {(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-compass-muted">
                          {db.collectionCount}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Link href={`/databases/${db.name}`}>
                              <Button variant="outline" size="sm" className="gap-2 border-gray-200 dark:border-compass-border dark:hover:bg-compass-border/30 dark:hover:text-white">
                                View collections
                                <ExternalLink size={14} />
                              </Button>
                            </Link>
                            {!systemDatabases.includes(db.name) ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setDbToDrop(db.name)}
                                disabled={isReadOnlyMode}
                                title={isReadOnlyMode ? "Read-only mode is enabled" : undefined}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 size={14} />
                              </Button>
                            ) : (
                              <div className="w-9" /> // Placeholder to maintain alignment for system dbs
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {databases?.map((db: any) => (
                  <div key={db.name} className="bg-white dark:bg-compass-bg border border-gray-200 dark:border-compass-border rounded-xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                        <Database size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-compass-text truncate">{db.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-compass-muted">{(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB • {db.collectionCount} collections</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/databases/${db.name}`} className="flex-1">
                        <Button variant="outline" className="w-full h-12 gap-2 dark:border-compass-border dark:hover:bg-compass-border/30 dark:hover:text-white">
                          View collections
                          <ExternalLink size={16} />
                        </Button>
                      </Link>
                      {!systemDatabases.includes(db.name) && (
                        <Button 
                          variant="outline" 
                          className="h-12 w-12 text-red-500 border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => setDbToDrop(db.name)}
                          disabled={isReadOnlyMode}
                          title={isReadOnlyMode ? "Read-only mode is enabled" : undefined}
                        >
                          <Trash2 size={18} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {databases?.length === 0 && (
                <div className="p-12 text-center text-gray-500 dark:text-compass-muted border border-dashed dark:border-compass-border rounded-xl">
                  No databases found on this server.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Drop Database Confirmation Modal */}
      {dbToDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#001e2b] text-white w-full max-w-md rounded-lg shadow-2xl border border-gray-800 overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-red-900/50 text-red-500 rounded-full">
                    <AlertTriangle size={24} />
                  </div>
                  <h2 className="text-2xl font-bold">Drop Database?</h2>
                </div>
                <button 
                  onClick={() => { setDbToDrop(null); setConfirmName(""); setDropError(null); }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300">
                  Are you sure you want to drop database <span className="font-bold text-white">&quot;{dbToDrop}&quot;</span>?
                </p>

                <div className="space-y-3">
                  <Label htmlFor="confirmName" className="text-sm font-medium text-gray-300">
                    Type <span className="font-bold text-white">&quot;{dbToDrop}&quot;</span> to confirm your action
                  </Label>
                  <Input
                    id="confirmName"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={dbToDrop}
                    className="bg-[#001e2b] border-gray-700 focus:border-blue-500 text-white h-12"
                    autoFocus
                  />
                </div>

                {dropError && (
                  <div className="p-3 bg-red-900/20 border border-red-900/50 text-red-400 text-sm rounded">
                    {dropError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => { setDbToDrop(null); setConfirmName(""); setDropError(null); }}
                    className="text-gray-300 hover:text-white hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDropDatabase}
                    disabled={isReadOnlyMode || confirmName !== dbToDrop || isDropping}
                    className={cn(
                      "min-w-[120px]",
                      confirmName === dbToDrop 
                        ? "bg-red-600 hover:bg-red-700 text-white" 
                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    {isDropping ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      "Drop Database"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
