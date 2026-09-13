import { useQuery } from "@tanstack/react-query";
import { getDocument } from "../api/documents";

export function useDocument(collection: string, id: string) {
  return useQuery<Record<string, unknown>>({
    queryKey: ["document", collection, id],
    queryFn: () => getDocument(collection, id),
    enabled: Boolean(collection) && Boolean(id),
  });
}
