import { NextResponse } from 'next/server';
import {
  APP_MODE,
  MAX_QUERY_STRING_LENGTH,
  SYSTEM_DATABASES,
} from '@/src/lib/constants';
import { parseQueryObject } from '@/src/lib/query-parser';

export function isReadOnlyMode() {
  return APP_MODE === 'readonly';
}

export function readOnlyResponse() {
  return NextResponse.json(
    { error: 'This action is disabled because MONGO_GUI_MODE=readonly.' },
    { status: 403 }
  );
}

export function ensureWritable() {
  return isReadOnlyMode() ? readOnlyResponse() : null;
}

export function isSystemDatabase(dbName: string) {
  return (SYSTEM_DATABASES as readonly string[]).includes(dbName);
}

export function blockSystemDatabaseWrite(dbName: string) {
  if (!isSystemDatabase(dbName)) return null;
  return NextResponse.json(
    { error: `Write operations are blocked on system database "${dbName}".` },
    { status: 403 }
  );
}

export function safeJsonObject(input: string | null, fallback: Record<string, unknown> = {}) {
  const value = input ?? JSON.stringify(fallback);
  if (value.length > MAX_QUERY_STRING_LENGTH) {
    throw new Error(`JSON input is too large. Max ${MAX_QUERY_STRING_LENGTH} characters.`);
  }
  const parsed = parseQueryObject(value, 'Query');
  assertNoDangerousOperators(parsed);
  return parsed;
}

export function safeJsonArray(input: unknown) {
  if (!Array.isArray(input)) throw new Error('JSON value must be an array.');
  assertNoDangerousOperators(input);
  return input as unknown[];
}

const blockedOperators = new Set([
  '$where',
  '$function',
  '$accumulator',
]);

export function assertNoDangerousOperators(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoDangerousOperators(item);
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      throw new Error(`Property ${key} is disabled for safety.`);
    }
    if (blockedOperators.has(key)) {
      throw new Error(`Operator ${key} is disabled for safety.`);
    }
    assertNoDangerousOperators(child);
  }
}

export function normalizeIndexName(name: string) {
  return decodeURIComponent(name).trim();
}

export function getRequestSize(request: Request) {
  const header = request.headers.get('content-length');
  if (!header) return null;
  const size = Number(header);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

export function boundedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function assertValidSort(sort: Record<string, unknown>) {
  for (const [field, direction] of Object.entries(sort)) {
    if (direction !== 1 && direction !== -1) {
      throw new Error(`Sort direction for "${field}" must be 1 or -1.`);
    }
  }
}
