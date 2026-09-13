import { useState } from "react";
import { tryParseJson } from "../lib/json";

interface FilterBarProps {
  value: string;
  onApply: (filter: string) => void;
}

export function FilterBar({ value, onApply }: FilterBarProps): JSX.Element {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  function handleApply(): void {
    const result = tryParseJson(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onApply(draft);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1 font-mono text-sm"
          placeholder='{"field": "value"}'
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
          onClick={handleApply}
        >
          Применить
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
