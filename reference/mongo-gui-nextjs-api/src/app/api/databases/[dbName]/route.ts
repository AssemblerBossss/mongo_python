import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { ensureWritable, isSystemDatabase } from '@/src/lib/api-guards';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ dbName: string }> }
) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName } = await params;

    if (isSystemDatabase(dbName)) {
      return NextResponse.json(
        { error: `Cannot drop system database "${dbName}"` },
        { status: 403 }
      );
    }

    const client = await clientPromise;
    await client.db(dbName).dropDatabase();

    return NextResponse.json({ success: true, message: `Database "${dbName}" dropped` });
  } catch (err) {
    console.error('Drop database error:', err);
    return NextResponse.json({ error: 'Failed to drop database' }, { status: 500 });
  }
}
