import type { ReactNode } from "react";
import { formatValue } from "../lib/format";

export type FieldType = "string" | "number" | "boolean" | "object" | "array" | "unknown";

interface FieldRendererProps {
  value: unknown;
}

// Точка расширения: добавляйте свои рендереры по типу поля сюда.
const renderers: Record<FieldType, (value: unknown) => ReactNode> = {
  string: (value) => <span>{String(value)}</span>,
  number: (value) => <span>{String(value)}</span>,
  boolean: (value) => <span>{value ? "true" : "false"}</span>,
  object: (value) => <code>{formatValue(value)}</code>,
  array: (value) => <code>{formatValue(value)}</code>,
  unknown: (value) => <span>{formatValue(value)}</span>,
};

function resolveType(value: unknown): FieldType {
  if (value === null || value === undefined) return "unknown";
  if (Array.isArray(value)) return "array";
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") return type;
  if (type === "object") return "object";
  return "unknown";
}

export function FieldRenderer({ value }: FieldRendererProps): JSX.Element {
  const type = resolveType(value);
  return <>{renderers[type](value)}</>;
}

export { renderers as fieldRenderers };
