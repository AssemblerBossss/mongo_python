import { useQuery } from "@tanstack/react-query";
import { getCollectionFilters } from "../api/collections";
import type { FilterFieldInfo } from "../api/types";

export function useCollectionFilters(name: string) {
    return useQuery<FilterFieldInfo[]>({
      queryKey: ["filters", name],
      queryFn: () => getCollectionFilters(name),
      enabled: Boolean(name),
    });
  }