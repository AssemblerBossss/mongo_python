import JSON5 from 'json5';

type JsonObject = Record<string, unknown>;

function formatParseError(error: unknown, label: string): Error {
  const message = error instanceof Error ? error.message : 'Invalid query syntax.';
  return new Error(
    `${label} is invalid: ${message}. ` +
    'Use an object such as { status: "active" } or { "status": "active" }.'
  );
}

export function parseQueryObject(value: string, label = 'Query'): JsonObject {
  let parsed: unknown;

  try {
    // JSON5 safely supports the MongoDB/Compass-style conveniences users expect
    // here: unquoted property names, single quotes, comments and trailing commas.
    // It parses data only and does not execute JavaScript.
    parsed = JSON5.parse(value);
  } catch (error) {
    throw formatParseError(error, label);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be an object.`);
  }

  return parsed as JsonObject;
}
