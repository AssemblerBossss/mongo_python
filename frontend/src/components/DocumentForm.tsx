import { useState, type FormEvent } from "react";
import type { FieldInfo } from "../api/types";
import { tryParseJson } from "../lib/json";

interface DocumentFormProps {
  fields: FieldInfo[];
  initialValue?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitLabel?: string;
}

export function DocumentForm({
  fields,
  initialValue,
  onSubmit,
  submitLabel = "Сохранить",
}: DocumentFormProps): JSX.Element {
  const [raw, setRaw] = useState(() => JSON.stringify(initialValue ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const result = tryParseJson(raw);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (typeof result.value !== "object" || result.value === null || Array.isArray(result.value)) {
      setError("Документ должен быть JSON-объектом");
      return;
    }
    setError(null);
    onSubmit(result.value as Record<string, unknown>);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      {fields.length > 0 && (
        <p className="text-xs text-gray-500">
          Известные поля: {fields.map((field) => field.name).join(", ")}
        </p>
      )}
      <textarea
        className="h-64 w-full rounded border p-2 font-mono text-sm"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
      />
      {error && <span className="text-sm text-red-600">{error}</span>}
      <button
        type="submit"
        className="self-start rounded bg-gray-800 px-4 py-1.5 text-sm text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}
