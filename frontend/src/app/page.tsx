"use client";

import { useState } from "react";
import { cn } from "@/src/lib/utils";
import Sidebar from "@/src/components/custom/Sidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Layers, ChevronRight, Trash2, AlertTriangle, Plus, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export default function CollectionsPage() {
  const queryClient = useQueryClient();
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: collections, isLoading, error } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const res = await fetch("/api/collections");
      if (!res.ok) throw new Error("Failed to fetch collections");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (collectionName: string) => {
      const res = await fetch(`/api/collections/${collectionName}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete collection");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setCollectionToDelete(null);
      setConfirmName("");
      setDeleteError(null);
    },
    onError: (err: any) => {
      setDeleteError(err.message);
    },
    onSettled: () => {
      setIsDeleting(false);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create collection");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setIsCreating(false);
      setNewCollectionName("");
      setCreateError(null);
    },
    onError: (err: any) => {
      setCreateError(err.message);
    },
  });

  const confirmCreate = () => {
    if (newCollectionName.trim()) {
      createMutation.mutate(newCollectionName.trim());
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, collectionName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCollectionToDelete(collectionName);
    setDeleteError(null);
  };

  const confirmDelete = () => {
    if (confirmName === collectionToDelete) {
      setIsDeleting(true);
      deleteMutation.mutate(collectionToDelete);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-compass-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 lg:pt-8">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-compass-text">Collections</h1>
              <p className="text-gray-500 dark:text-compass-muted mt-2">Browse collections in the database.</p>
            </div>
            <Button onClick={() => setIsCreating(true)} className="self-start sm:self-auto">
              <Plus size={16} /> New Collection
            </Button>
          </header>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Loading collections...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-400">
              Error: {(error as Error).message}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {collections?.map((col: any) => (
                <Link key={col.name} href={`/collections/${col.name}`}>
                  <div className="p-6 bg-white dark:bg-compass-bg border border-gray-200 dark:border-compass-border rounded-xl hover:border-blue-300 dark:hover:border-compass-green hover:shadow-md transition-all group cursor-pointer relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Layers size={20} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDeleteClick(e, col.name)}
                        >
                          <Trash2 size={16} />
                        </Button>
                        <ChevronRight size={18} className="text-gray-300 dark:text-gray-700 group-hover:text-blue-500 dark:group-hover:text-compass-green transition-colors" />
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-compass-text mb-1">{col.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-compass-muted">
                      {col.count} documents
                    </p>
                  </div>
                </Link>
              ))}
              {collections?.length === 0 && (
                <div className="col-span-full p-12 text-center text-gray-500 dark:text-compass-muted border border-dashed dark:border-compass-border rounded-xl">
                  No collections found.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create Collection Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-compass-bg text-gray-900 dark:text-compass-text w-full max-w-md rounded-lg shadow-2xl border border-gray-200 dark:border-compass-border overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold">New Collection</h2>
                <button
                  onClick={() => { setIsCreating(false); setNewCollectionName(""); setCreateError(null); }}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="newCollectionName">Collection name</Label>
                  <Input
                    id="newCollectionName"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="h-12"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && confirmCreate()}
                  />
                </div>

                {createError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm rounded">
                    {createError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => { setIsCreating(false); setNewCollectionName(""); setCreateError(null); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmCreate}
                    disabled={!newCollectionName.trim() || createMutation.isPending}
                    className="min-w-[120px]"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Collection Confirmation Modal */}
      {collectionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#001e2b] text-white w-full max-w-md rounded-lg shadow-2xl border border-gray-800 overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-red-900/50 text-red-500 rounded-full">
                    <AlertTriangle size={24} />
                  </div>
                  <h2 className="text-2xl font-bold">Drop Collection?</h2>
                </div>
                <button
                  onClick={() => { setCollectionToDelete(null); setConfirmName(""); setDeleteError(null); }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <p className="text-gray-300">
                  Are you sure you want to drop collection <span className="font-bold text-white">&quot;{collectionToDelete}&quot;</span>? This action cannot be undone.
                </p>

                <div className="space-y-3">
                  <Label htmlFor="confirmName" className="text-sm font-medium text-gray-300">
                    Type <span className="font-bold text-white">&quot;{collectionToDelete}&quot;</span> to confirm
                  </Label>
                  <Input
                    id="confirmName"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={collectionToDelete}
                    className="bg-[#001e2b] border-gray-700 focus:border-blue-500 text-white h-12"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && confirmDelete()}
                  />
                </div>

                {deleteError && (
                  <div className="p-3 bg-red-900/20 border border-red-900/50 text-red-400 text-sm rounded">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => { setCollectionToDelete(null); setConfirmName(""); setDeleteError(null); }}
                    className="text-gray-300 hover:text-white hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmDelete}
                    disabled={confirmName !== collectionToDelete || isDeleting}
                    className={cn(
                      "min-w-[120px]",
                      confirmName === collectionToDelete
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    {isDeleting ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      "Drop Collection"
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
