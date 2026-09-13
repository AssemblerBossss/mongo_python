import { useQuery } from "@tanstack/react-query";
import { getCollections } from "../api/collections";
import type { CollectionInfo } from "../api/types";

export function useCollections() {
  return useQuery<CollectionInfo[]>({
    queryKey: ["collections"],
    queryFn: getCollections,
  });
}
