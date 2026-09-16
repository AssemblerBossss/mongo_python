import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { MONGO_QUERY_MAX_TIME_MS } from '@/src/lib/constants';

type Params = { params: Promise<{ dbName: string; collectionName: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { dbName, collectionName } = await params;
    const client = await clientPromise;
    const db = client.db(dbName);
    const stats = await db.command({ collStats: collectionName, maxTimeMS: MONGO_QUERY_MAX_TIME_MS });
    return NextResponse.json({ stats });
  } catch (err) {
    console.error('Collection stats error:', err);
    return NextResponse.json({ error: 'Failed to fetch collection stats' }, { status: 500 });
  }
}
