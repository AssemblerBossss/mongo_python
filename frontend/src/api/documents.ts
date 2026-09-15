import { apiFetch } from "./client";
import type { DocumentsPage, DocumentsQueryParams } from "./types";

function buildQuery(params: DocumentsQueryParams): string {
  const search = new URLSearchParams();
  if (params.conditions && params.conditions.length > 0) {
    search.set("conditions", JSON.stringify(params.conditions));
  }
  if (params.skip !== undefined) search.set("skip", String(params.skip));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.sortBy) search.set("sort_by", params.sortBy);
  if (params.sortDir !== undefined) search.set("sort_dir", String(params.sortDir));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getDocuments(
  collection: string,
  params: DocumentsQueryParams = {},
): Promise<DocumentsPage> {
  return apiFetch<DocumentsPage>(
    `/api/collections/${encodeURIComponent(collection)}/documents${buildQuery(params)}`,
  );
}

export function getDocument(collection: string, id: string): Promise<Record<string, unknown>> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents/${id}`);
}

export function createDocument(
  collection: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function replaceDocument(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function patchDocument(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteDocument(collection: string, id: string): Promise<void> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents/${id}`, {
    method: "DELETE",
  });
}
