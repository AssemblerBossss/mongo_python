import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { CollectionView } from "../components/CollectionView";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DocumentForm } from "../components/DocumentForm";
import { useCollectionFields } from "../hooks/useCollectionFields";
import { createDocument } from "../api/documents";
import { dropCollection } from "../api/collections";
import { importFiles } from "../api/imports";
import { ApiRequestError } from "../api/client";

export function CollectionPage(): JSX.Element {
  const { name = "" } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: fields = [] } = useCollectionFields(name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

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

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadMessage(null);
    try {
      const summary = await importFiles(name, files);
      setUploadMessage(
        `Загружено: ${summary.total_imported}, пропущено: ${summary.total_skipped} (файлов: ${files.length})`,
      );
      await queryClient.invalidateQueries({ queryKey: ["documents", name] });
      await queryClient.invalidateQueries({ queryKey: ["fields", name] });
    } catch (error) {
      const detail = error instanceof ApiRequestError ? error.payload.detail : "Не удалось загрузить файлы";
      setUploadMessage(detail);
    } finally {
      setIsUploading(false);
    }
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
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            multiple
            hidden
            onChange={handleFilesSelected}
          />
          <button
            type="button"
            disabled={isUploading}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? "Загрузка…" : "Загрузить файлы"}
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

      {uploadMessage && <p className="text-sm text-gray-600">{uploadMessage}</p>}

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
