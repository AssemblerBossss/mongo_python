import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { MONGO_QUERY_MAX_TIME_MS } from '@/src/lib/constants';
import {
  blockSystemDatabaseWrite,
  ensureWritable,
  safeJsonObject,
} from '@/src/lib/api-guards';

function hasUpdateOperator(update: Record<string, unknown>) {
  return Object.keys(update).some((key) => key.startsWith('$'));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dbName: string; collectionName: string }> }
) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName, collectionName } = await params;
    const systemBlocked = blockSystemDatabaseWrite(dbName);
    if (systemBlocked) return systemBlocked;

    const body = await request.json().catch(() => null);
    const filter = safeJsonObject(typeof body?.filter === 'string' ? body.filter : JSON.stringify(body?.filter ?? {}), {});
    const update = safeJsonObject(typeof body?.update === 'string' ? body.update : JSON.stringify(body?.update ?? {}), {});

    if (!hasUpdateOperator(update)) {
      return NextResponse.json(
        { error: 'Bulk update requires update operators like $set, $unset, $inc, etc.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const result = await client
      .db(dbName)
      .collection(collectionName)
      .updateMany(filter, update, { maxTimeMS: MONGO_QUERY_MAX_TIME_MS });

    return NextResponse.json({
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      acknowledged: result.acknowledged,
      message: `Updated ${result.modifiedCount} of ${result.matchedCount} matched documents.`,
    });
  } catch (err) {
    console.error('Documents BULK PATCH error:', err);
    return NextResponse.json({ error: (err as Error).message || 'Bulk update failed' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ dbName: string; collectionName: string }> }
) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName, collectionName } = await params;
    const systemBlocked = blockSystemDatabaseWrite(dbName);
    if (systemBlocked) return systemBlocked;

    const body = await request.json().catch(() => null);
    const filter = safeJsonObject(typeof body?.filter === 'string' ? body.filter : JSON.stringify(body?.filter ?? {}), {});
    const confirm = String(body?.confirm ?? '');

    if (confirm !== collectionName) {
      return NextResponse.json(
        { error: `Confirmation is required. Type the collection name: ${collectionName}` },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const result = await client
      .db(dbName)
      .collection(collectionName)
      .deleteMany(filter, { maxTimeMS: MONGO_QUERY_MAX_TIME_MS });

    return NextResponse.json({
      deletedCount: result.deletedCount,
      acknowledged: result.acknowledged,
      message: `Deleted ${result.deletedCount} documents.`,
    });
  } catch (err) {
    console.error('Documents BULK DELETE error:', err);
    return NextResponse.json({ error: (err as Error).message || 'Bulk delete failed' }, { status: 400 });
  }
}
