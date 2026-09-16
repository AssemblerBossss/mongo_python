import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { blockSystemDatabaseWrite, ensureWritable } from '@/src/lib/api-guards';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ dbName: string; collectionName: string }> }
) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName, collectionName } = await params;
    const systemBlocked = blockSystemDatabaseWrite(dbName);
    if (systemBlocked) return systemBlocked;

    const client = await clientPromise;
    await client.db(dbName).collection(collectionName).drop();

    return NextResponse.json({
      success: true,
      message: `Collection "${collectionName}" dropped from "${dbName}"`,
    });
  } catch (err) {
    console.error('Drop collection error:', err);
    return NextResponse.json({ error: 'Failed to drop collection' }, { status: 500 });
  }
}
