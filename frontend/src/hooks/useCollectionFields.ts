import { useQuery } from "@tanstack/react-query";
import { getCollectionFields } from "../api/collections";
import type { FieldInfo } from "../api/types";

export function useCollectionFields(name: string) {
  return useQuery<FieldInfo[]>({
    queryKey: ["fields", name],
    queryFn: () => getCollectionFields(name),
    enabled: Boolean(name),
  });
}
