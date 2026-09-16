/**
 * Central JWT configuration.
 *
 * Throws at module-load time if JWT_SECRET is missing or too short so the
 * server refuses to start rather than running with a weak / known key.
 * NO fallback value is ever provided.
 */

const raw = process.env.JWT_SECRET;

if (!raw) {
  throw new Error(
    '[FATAL] JWT_SECRET environment variable is not set.\n' +
    'Generate one with:  openssl rand -base64 32'
  );
}

if (raw.length < 32) {
  throw new Error(
    `[FATAL] JWT_SECRET is too short (${raw.length} chars, minimum 32).\n` +
    'Generate a secure value with:  openssl rand -base64 32'
  );
}

export const JWT_SECRET = new TextEncoder().encode(raw);
