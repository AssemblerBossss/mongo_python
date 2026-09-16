import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { ObjectId } from 'mongodb';
import { blockSystemDatabaseWrite, ensureWritable } from '@/src/lib/api-guards';
import { MONGO_QUERY_MAX_TIME_MS } from '@/src/lib/constants';

type Params = { params: Promise<{ dbName: string; collectionName: string; docId: string }> };

function parseObjectId(id: string): ObjectId | null {
  try { return new ObjectId(id); } catch { return null; }
}

export async function DELETE(_request: Request, { params }: Params) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName, collectionName, docId } = await params;
    const systemBlocked = blockSystemDatabaseWrite(dbName);
    if (systemBlocked) return systemBlocked;

    const oid = parseObjectId(docId);
    if (!oid) return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });

    const client = await clientPromise;
    const result = await client
      .db(dbName)
      .collection(collectionName)
      .deleteOne({ _id: oid }, { maxTimeMS: MONGO_QUERY_MAX_TIME_MS });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    console.error('Delete document error:', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName, collectionName, docId } = await params;
    const systemBlocked = blockSystemDatabaseWrite(dbName);
    if (systemBlocked) return systemBlocked;

    const oid = parseObjectId(docId);
    if (!oid) return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const { _id, ...updateData } = body as Record<string, unknown>;
    void _id;

    const client = await clientPromise;
    const result = await client.db(dbName).collection(collectionName).replaceOne(
      { _id: oid },
      { _id: oid, ...updateData },
      { maxTimeMS: MONGO_QUERY_MAX_TIME_MS }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Document updated' });
  } catch (err) {
    console.error('Update document error:', err);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}
