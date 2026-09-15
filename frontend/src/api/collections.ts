import { apiFetch } from "./client";
import type { CollectionInfo, FieldInfo, FilterFieldInfo } from "./types";

export function getCollections(): Promise<CollectionInfo[]> {
  return apiFetch<CollectionInfo[]>("/api/collections");
}

export function createCollection(name: string): Promise<CollectionInfo> {
  return apiFetch<CollectionInfo>("/api/collections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function dropCollection(name: string): Promise<void> {
  return apiFetch<void>(`/api/collections/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export function getCollectionFields(name: string): Promise<FieldInfo[]> {
  return apiFetch<FieldInfo[]>(`/api/collections/${encodeURIComponent(name)}/fields`);
}

export function getCollectionFilters(name: string): Promise<FilterFieldInfo[]> {
  return apiFetch<FilterFieldInfo[]>(`/api/collections/${encodeURIComponent(name)}/filters`);
  
}