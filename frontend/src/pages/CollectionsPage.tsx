import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createCollection } from "../api/collections";
import { useCollections } from "../hooks/useCollections";
import { EmptyState } from "../components/EmptyState";

export function CollectionsPage(): JSX.Element {
  const { data: collections, isLoading } = useCollections();
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!name.trim()) return;
    await createCollection(name.trim());
    setName("");
    await queryClient.invalidateQueries({ queryKey: ["collections"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Коллекции</h1>

      <form className="flex gap-2" onSubmit={handleCreate}>
        <input
          className="rounded border px-2 py-1 text-sm"
          placeholder="Имя новой коллекции"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="rounded bg-gray-800 px-3 py-1 text-sm text-white">
          Создать
        </button>
      </form>

      {isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}

      {!isLoading && collections?.length === 0 && (
        <EmptyState title="Коллекций пока нет" description="Создайте первую коллекцию выше" />
      )}

      <ul className="flex flex-col gap-1">
        {collections?.map((collection) => (
          <li key={collection.name}>
            <button
              type="button"
              className="text-left text-sm text-blue-600 hover:underline"
              onClick={() => navigate(`/collections/${collection.name}`)}
            >
              {collection.name} ({collection.count})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
