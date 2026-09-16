import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { blockSystemDatabaseWrite, ensureWritable, normalizeIndexName } from '@/src/lib/api-guards';
import { MONGO_QUERY_MAX_TIME_MS } from '@/src/lib/constants';

type Params = { params: Promise<{ dbName: string; collectionName: string; indexName: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName, collectionName, indexName } = await params;
    const systemBlocked = blockSystemDatabaseWrite(dbName);
    if (systemBlocked) return systemBlocked;

    const decodedName = normalizeIndexName(indexName);
    if (decodedName === '_id_') {
      return NextResponse.json({ error: 'The default _id index cannot be dropped.' }, { status: 400 });
    }

    const client = await clientPromise;
    await client.db(dbName).collection(collectionName).dropIndex(decodedName, { maxTimeMS: MONGO_QUERY_MAX_TIME_MS });
    return NextResponse.json({ success: true, message: `Index ${decodedName} dropped.` });
  } catch (err) {
    console.error('Indexes DELETE error:', err);
    return NextResponse.json({ error: 'Failed to drop index' }, { status: 500 });
  }
}
