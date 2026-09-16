import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { MAX_SCHEMA_SAMPLE_SIZE, MONGO_QUERY_MAX_TIME_MS } from '@/src/lib/constants';
import { boundedInteger } from '@/src/lib/api-guards';

type Params = { params: Promise<{ dbName: string; collectionName: string }> };

type FieldInfo = {
  path: string;
  count: number;
  types: Record<string, number>;
  examples: unknown[];
};

function typeOfValue(value: unknown) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  return typeof value;
}

function collectFields(doc: unknown, map: Map<string, FieldInfo>, prefix = '') {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return;
  for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const valueType = typeOfValue(value);
    const info = map.get(path) ?? { path, count: 0, types: {}, examples: [] };
    info.count += 1;
    info.types[valueType] = (info.types[valueType] ?? 0) + 1;
    if (info.examples.length < 5 && value !== undefined) info.examples.push(value);
    map.set(path, info);

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      collectFields(value, map, path);
    }
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { dbName, collectionName } = await params;
    const body = await request.json().catch(() => null) as { sampleSize?: number } | null;
    const sampleSize = boundedInteger(body?.sampleSize, 500, 1, MAX_SCHEMA_SAMPLE_SIZE);

    const client = await clientPromise;
    const collection = client.db(dbName).collection(collectionName);
    const docs = await collection.aggregate([
      { $sample: { size: sampleSize } },
    ], { maxTimeMS: MONGO_QUERY_MAX_TIME_MS }).toArray();

    const fields = new Map<string, FieldInfo>();
    for (const doc of docs) collectFields(doc, fields);

    const result = [...fields.values()]
      .map((field) => ({
        ...field,
        presence: docs.length ? Number(((field.count / docs.length) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    return NextResponse.json({ sampleSize: docs.length, fields: result });
  } catch (err) {
    console.error('Schema analysis error:', err);
    return NextResponse.json({ error: 'Failed to analyze schema' }, { status: 500 });
  }
}
