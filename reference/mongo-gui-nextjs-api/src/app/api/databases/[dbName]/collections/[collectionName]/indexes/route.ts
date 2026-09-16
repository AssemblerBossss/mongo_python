import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { assertNoDangerousOperators, blockSystemDatabaseWrite, ensureWritable } from '@/src/lib/api-guards';
import { MONGO_QUERY_MAX_TIME_MS } from '@/src/lib/constants';

type Params = { params: Promise<{ dbName: string; collectionName: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { dbName, collectionName } = await params;
    const client = await clientPromise;
    const indexes = await client.db(dbName).collection(collectionName).indexes({ maxTimeMS: MONGO_QUERY_MAX_TIME_MS });
    return NextResponse.json({ indexes });
  } catch (err) {
    console.error('Indexes GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch indexes' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName, collectionName } = await params;
    const systemBlocked = blockSystemDatabaseWrite(dbName);
    if (systemBlocked) return systemBlocked;

    const body = await request.json().catch(() => null) as {
      keys?: Record<string, 1 | -1 | 'text' | 'hashed'>;
      options?: Record<string, unknown>;
    } | null;

    if (!body?.keys || typeof body.keys !== 'object' || Array.isArray(body.keys) || Object.keys(body.keys).length === 0) {
      return NextResponse.json({ error: 'Index keys must be a non-empty JSON object.' }, { status: 400 });
    }

    const allowedDirections = new Set([1, -1, 'text', 'hashed']);
    for (const [field, direction] of Object.entries(body.keys)) {
      if (!field.trim()) return NextResponse.json({ error: 'Index field name cannot be empty.' }, { status: 400 });
      if (!allowedDirections.has(direction)) {
        return NextResponse.json({ error: `Invalid index direction for ${field}.` }, { status: 400 });
      }
    }

    const safeOptions = body.options ?? {};
    assertNoDangerousOperators(body.keys);
    assertNoDangerousOperators(safeOptions);
    const client = await clientPromise;
    const name = await client
      .db(dbName)
      .collection(collectionName)
      .createIndex(body.keys, { ...safeOptions, maxTimeMS: MONGO_QUERY_MAX_TIME_MS });

    return NextResponse.json({ success: true, name });
  } catch (err) {
    console.error('Indexes POST error:', err);
    return NextResponse.json({ error: 'Failed to create index' }, { status: 500 });
  }
}
