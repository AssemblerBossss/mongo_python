import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DocumentForm } from "../components/DocumentForm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useDocument } from "../hooks/useDocument";
import { useCollectionFields } from "../hooks/useCollectionFields";
import { replaceDocument, deleteDocument } from "../api/documents";

export function DocumentPage(): JSX.Element {
  const { name = "", id = "" } = useParams<{ name: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: document, isLoading } = useDocument(name, id);
  const { data: fields = [] } = useCollectionFields(name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave(data: Record<string, unknown>): Promise<void> {
    await replaceDocument(name, id, data);
    await queryClient.invalidateQueries({ queryKey: ["document", name, id] });
    await queryClient.invalidateQueries({ queryKey: ["documents", name] });
  }

  async function handleDelete(): Promise<void> {
    await deleteDocument(name, id);
    await queryClient.invalidateQueries({ queryKey: ["documents", name] });
    navigate(`/collections/${name}`);
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400">Загрузка…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Документ {id}</h1>
        <button
          type="button"
          className="rounded bg-red-600 px-3 py-1 text-sm text-white"
          onClick={() => setConfirmDelete(true)}
        >
          Удалить
        </button>
      </div>

      <DocumentForm fields={fields} initialValue={document} onSubmit={handleSave} />

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить документ?"
        description="Это действие необратимо."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
