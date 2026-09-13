import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CollectionView } from "../components/CollectionView";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DocumentForm } from "../components/DocumentForm";
import { useCollectionFields } from "../hooks/useCollectionFields";
import { createDocument } from "../api/documents";
import { dropCollection } from "../api/collections";

export function CollectionPage(): JSX.Element {
  const { name = "" } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: fields = [] } = useCollectionFields(name);

  const [showCreate, setShowCreate] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);

  async function handleCreate(data: Record<string, unknown>): Promise<void> {
    await createDocument(name, data);
    setShowCreate(false);
    await queryClient.invalidateQueries({ queryKey: ["documents", name] });
  }

  async function handleDropCollection(): Promise<void> {
    await dropCollection(name);
    await queryClient.invalidateQueries({ queryKey: ["collections"] });
    navigate("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{name}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
            onClick={() => setShowCreate((v) => !v)}
          >
            Создать документ
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1 text-sm text-white"
            onClick={() => setConfirmDrop(true)}
          >
            Удалить коллекцию
          </button>
        </div>
      </div>

      {showCreate && (
        <DocumentForm fields={fields} onSubmit={handleCreate} submitLabel="Создать" />
      )}

      <CollectionView
        collection={name}
        onRowClick={(id) => navigate(`/collections/${name}/documents/${id}`)}
      />

      <ConfirmDialog
        open={confirmDrop}
        title={`Удалить коллекцию "${name}"?`}
        description="Это действие необратимо."
        onConfirm={handleDropCollection}
        onCancel={() => setConfirmDrop(false)}
      />
    </div>
  );
}
