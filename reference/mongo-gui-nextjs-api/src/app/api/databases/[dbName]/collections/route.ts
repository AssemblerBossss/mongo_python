import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dbName: string }> }
) {
  try {
    const { dbName } = await params;
    const client     = await clientPromise;
    const db         = client.db(dbName);

    const collections = await db.listCollections().toArray();

    const enriched = await Promise.all(
      collections.map(async (col) => {
        const count = await db.collection(col.name).estimatedDocumentCount();
        return { ...col, documentCount: count };
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('Collections API error:', err);
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}
