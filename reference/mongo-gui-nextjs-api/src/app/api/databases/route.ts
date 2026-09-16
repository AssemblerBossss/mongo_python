import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';

export async function GET() {
  try {
    const client   = await clientPromise;
    const adminDb  = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    const enriched = await Promise.all(
      databases.map(async (dbInfo) => {
        const db = client.db(dbInfo.name);
        const collections = await db.listCollections().toArray();
        return { ...dbInfo, collectionCount: collections.length };
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('Databases API error:', err);
    return NextResponse.json({ error: 'Failed to fetch databases' }, { status: 500 });
  }
}
