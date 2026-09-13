import { NavLink } from "react-router-dom";
import { useCollections } from "../hooks/useCollections";

export function Sidebar(): JSX.Element {
  const { data: collections, isLoading } = useCollections();

  return (
    <aside className="w-56 shrink-0 border-r bg-gray-50 p-4">
      <NavLink to="/" className="mb-4 block text-sm font-semibold text-gray-700">
        Коллекции
      </NavLink>
      {isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}
      <nav className="flex flex-col gap-1">
        {collections?.map((collection) => (
          <NavLink
            key={collection.name}
            to={`/collections/${collection.name}`}
            className={({ isActive }) =>
              `rounded px-2 py-1 text-sm ${isActive ? "bg-gray-200 font-medium" : "hover:bg-gray-100"}`
            }
          >
            {collection.name}
            <span className="ml-1 text-xs text-gray-400">({collection.count})</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
