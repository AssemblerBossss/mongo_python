import { useQuery } from "@tanstack/react-query";
import { getDocuments } from "../api/documents";
import type { DocumentsPage, DocumentsQueryParams } from "../api/types";

export function useDocuments(collection: string, params: DocumentsQueryParams) {
  return useQuery<DocumentsPage>({
    queryKey: ["documents", collection, params],
    queryFn: () => getDocuments(collection, params),
    enabled: Boolean(collection),
  });
}
