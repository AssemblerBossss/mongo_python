import { useState } from "react";
import type { FieldInfo } from "../api/types";
import { useCollectionFields } from "../hooks/useCollectionFields";
import { useDocuments } from "../hooks/useDocuments";
import { FieldRenderer } from "./FieldRenderer";
import { FilterBar } from "./FilterBar";
import { Pagination } from "./Pagination";
import { EmptyState } from "./EmptyState";

interface CollectionViewProps {
  collection: string;
  columnsOverride?: FieldInfo[];
  onRowClick?: (id: string) => void;
}

const LIMIT = 20;

export function CollectionView({
  collection,
  columnsOverride,
  onRowClick,
}: CollectionViewProps): JSX.Element {
  const [skip, setSkip] = useState(0);
  const [filter, setFilter] = useState("");

  const { data: fields } = useCollectionFields(collection);
  const columns = columnsOverride ?? fields ?? [];

  const { data: page, isLoading } = useDocuments(collection, {
    filter: filter || undefined,
    skip,
    limit: LIMIT,
  });

  if (isLoading) {
    return <p className="text-sm text-gray-400">Загрузка…</p>;
  }

  if (!page || page.items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <FilterBar
          value={filter}
          onApply={(value) => {
            setFilter(value);
            setSkip(0);
          }}
        />
        <EmptyState title="Документы не найдены" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        value={filter}
        onApply={(value) => {
          setFilter(value);
          setSkip(0);
        }}
      />
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100">
            <tr>
              {columns.map((column) => (
                <th key={column.name} className="px-3 py-2 font-medium">
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.items.map((item) => (
              <tr
                key={String(item._id)}
                className="cursor-pointer border-t hover:bg-gray-50"
                onClick={() => onRowClick?.(String(item._id))}
              >
                {columns.map((column) => (
                  <td key={column.name} className="px-3 py-2">
                    <FieldRenderer value={item[column.name]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination skip={skip} limit={LIMIT} total={page.total} onSkipChange={setSkip} />
    </div>
  );
}
