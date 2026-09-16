// ─────────────────────────────────────────────
// Application-wide constants — single source of truth
// ─────────────────────────────────────────────

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE     = 200;

// Query safety
export const MONGO_QUERY_MAX_TIME_MS = Number(process.env.MONGO_QUERY_MAX_TIME_MS ?? 5_000);
export const MAX_QUERY_STRING_LENGTH = Number(process.env.MAX_QUERY_STRING_LENGTH ?? 20_000);
export const MAX_AGGREGATION_STAGES  = Number(process.env.MAX_AGGREGATION_STAGES ?? 25);
export const MAX_SCHEMA_SAMPLE_SIZE  = Number(process.env.MAX_SCHEMA_SAMPLE_SIZE ?? 1_000);

// Import
export const MAX_IMPORT_DOCUMENTS = 10_000;
export const MAX_IMPORT_BODY_BYTES = Number(process.env.MAX_IMPORT_BODY_BYTES ?? 20 * 1024 * 1024); // 20 MB

// App modes: full | readonly
export const APP_MODE = (process.env.MONGO_GUI_MODE ?? 'full').toLowerCase();

// System databases that must never be dropped or modified via the UI
export const SYSTEM_DATABASES = ['admin', 'local', 'config'] as const;
export type SystemDatabase = typeof SYSTEM_DATABASES[number];
