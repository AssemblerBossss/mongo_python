import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import {
  DEFAULT_PAGE_SIZE,
  MAX_IMPORT_BODY_BYTES,
  MAX_IMPORT_DOCUMENTS,
  MAX_PAGE_SIZE,
  MONGO_QUERY_MAX_TIME_MS,
} from '@/src/lib/constants';
import {
  blockSystemDatabaseWrite,
  boundedInteger,
  ensureWritable,
  getRequestSize,
  assertValidSort,
  safeJsonArray,
  safeJsonObject,
} from '@/src/lib/api-guards';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dbName: string; collectionName: string }> }
) {
  try {
    const { dbName, collectionName } = await params;
    const { searchParams } = new URL(request.url);

    const page = boundedInteger(searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
    const limit = boundedInteger(searchParams.get('limit'), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

    let filter: Record<string, unknown> = {};
    let projection: Record<string, unknown> = {};
    let sort: Record<string, 1 | -1> = {};

    try {
      filter = safeJsonObject(searchParams.get('filter'), {});
      projection = safeJsonObject(searchParams.get('project'), {});
      sort = safeJsonObject(searchParams.get('sort'), {}) as Record<string, 1 | -1>;
      assertValidSort(sort);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }

    const client     = await clientPromise;
    const collection = client.db(dbName).collection(collectionName);

    const findCursor = collection
      .find(filter, { maxTimeMS: MONGO_QUERY_MAX_TIME_MS })
      .project(projection)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const [total, documents] = await Promise.all([
      collection.countDocuments(filter, { maxTimeMS: MONGO_QUERY_MAX_TIME_MS }),
      findCursor.toArray(),
    ]);

    return NextResponse.json({
      documents,
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
      query: { filter, projection, sort },
    });
  } catch (err) {
    console.error('Documents GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dbName: string; collectionName: string }> }
) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName, collectionName } = await params;
    const systemBlocked = blockSystemDatabaseWrite(dbName);
    if (systemBlocked) return systemBlocked;

    const contentLength = getRequestSize(request);
    if (contentLength && contentLength > MAX_IMPORT_BODY_BYTES) {
      return NextResponse.json(
        { error: `Import body too large. Max ${Math.round(MAX_IMPORT_BODY_BYTES / 1024 / 1024)} MB.` },
        { status: 413 }
      );
    }

    const body = await request.json().catch(() => null);
    let data: unknown[];

    try {
      data = safeJsonArray(body);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }

    if (data.length === 0) {
      return NextResponse.json({ error: 'Array is empty' }, { status: 400 });
    }
    if (data.length > MAX_IMPORT_DOCUMENTS) {
      return NextResponse.json(
        { error: `Import limited to ${MAX_IMPORT_DOCUMENTS.toLocaleString()} documents at once` },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const result = await client
      .db(dbName)
      .collection(collectionName)
      .insertMany(data as Record<string, unknown>[], { ordered: false });

    return NextResponse.json({
      message: `Successfully imported ${result.insertedCount} documents`,
      insertedCount: result.insertedCount,
    });
  } catch (err) {
    console.error('Documents POST error:', err);
    return NextResponse.json({ error: 'Failed to import documents' }, { status: 500 });
  }
}
