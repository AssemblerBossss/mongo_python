import { apiFetch } from "./client";
import type { ImportSummary } from "./types";

export function importFiles(collection: string, files: File[]): Promise<ImportSummary> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file, file.name);
  }

  return apiFetch<ImportSummary>(
    `/api/collections/${encodeURIComponent(collection)}/import/files`,
    { method: "POST", body: formData },
  );
}
