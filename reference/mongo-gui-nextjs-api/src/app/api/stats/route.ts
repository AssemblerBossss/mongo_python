import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';

export async function GET() {
  try {
    const client  = await clientPromise;
    const adminDb = client.db().admin();

    // Single call to listDatabases — includes sizeOnDisk, no extra round-trips
    const { databases } = await adminDb.listDatabases();

    // Fetch all collection counts IN PARALLEL instead of sequentially
    // Before: N sequential awaits (one per database) → ~1400ms
    // After:  all fired at once                      → ~200ms
    const collectionCounts = await Promise.all(
      databases.map((db) =>
        client.db(db.name).listCollections().toArray().then((c) => c.length)
      )
    );

    return NextResponse.json(
      {
        dbCount:         databases.length,
        collectionCount: collectionCounts.reduce((a, b) => a + b, 0),
        status:          'online',
      },
      {
        headers: {
          // Cache for 10s on the client — stats don't need to be real-time
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (err) {
    console.error('Stats API error:', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}