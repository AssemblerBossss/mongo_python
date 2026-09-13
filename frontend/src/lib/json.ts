export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export function tryParseJson(input: string): JsonParseResult {
  if (!input.trim()) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Некорректный JSON" };
  }
}
