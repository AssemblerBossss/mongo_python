"use client";

import Sidebar from "@/src/components/custom/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Activity, Cpu, Database, HardDrive, Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

export default function ServerStatsPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["server-stats"],
    queryFn: async () => {
      const res = await fetch("/api/server-stats");
      if (!res.ok) throw new Error("Failed to fetch server stats");
      return res.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Server Statistics</h1>
            <p className="text-gray-500 mt-2">Real-time monitoring of your MongoDB instance.</p>
          </header>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Loading server statistics...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              Error: {(error as Error).message}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                    <Cpu className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.serverStatus.mem.resident} MB</div>
                    <p className="text-xs text-muted-foreground">Resident Memory</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
                    <Users className="h-4 w-4 text-compass-green" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.serverStatus.connections.current}</div>
                    <p className="text-xs text-muted-foreground">{stats.serverStatus.connections.available} available</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Storage Size</CardTitle>
                    <HardDrive className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatBytes(stats.dbStats.storageSize)}</div>
                    <p className="text-xs text-muted-foreground">Total on disk</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                    <Clock className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatUptime(stats.serverStatus.uptime)}</div>
                    <p className="text-xs text-muted-foreground">Server version {stats.serverStatus.version}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-blue-500" />
                      Database Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-500">Collections</span>
                        <span className="font-semibold">{stats.dbStats.collections}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-500">Total Documents</span>
                        <span className="font-semibold">{stats.dbStats.objects}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-500">Data Size</span>
                        <span className="font-semibold">{formatBytes(stats.dbStats.dataSize)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-500">Index Size</span>
                        <span className="font-semibold">{formatBytes(stats.dbStats.indexSize)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-500">Avg Object Size</span>
                        <span className="font-semibold">{formatBytes(stats.dbStats.avgObjSize)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-compass-green" />
                      Operations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-500">Insert</span>
                        <span className="font-semibold text-compass-green">{stats.serverStatus.opcounters.insert}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-500">Query</span>
                        <span className="font-semibold text-blue-600">{stats.serverStatus.opcounters.query}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-500">Update</span>
                        <span className="font-semibold text-amber-600">{stats.serverStatus.opcounters.update}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-gray-500">Delete</span>
                        <span className="font-semibold text-red-600">{stats.serverStatus.opcounters.delete}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-500">GetMore</span>
                        <span className="font-semibold text-purple-600">{stats.serverStatus.opcounters.getmore}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
