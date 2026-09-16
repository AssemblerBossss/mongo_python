import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';

export async function GET() {
  try {
    const client   = await clientPromise;
    const adminDb  = client.db().admin();

    const serverStatus = await adminDb.serverStatus();
    const { databases } = await adminDb.listDatabases();

    let totalCollections = 0, totalObjects = 0, totalDataSize = 0;
    let totalStorageSize = 0, totalIndexSize = 0;
    let avgObjSizeSum = 0, avgObjSizeCount = 0;

    for (const dbInfo of databases) {
      try {
        const stats = await client.db(dbInfo.name).stats();
        totalCollections += stats.collections  ?? 0;
        totalObjects     += stats.objects      ?? 0;
        totalDataSize    += stats.dataSize     ?? 0;
        totalStorageSize += stats.storageSize  ?? 0;
        totalIndexSize   += stats.indexSize    ?? 0;
        if (stats.avgObjSize) { avgObjSizeSum += stats.avgObjSize; avgObjSizeCount++; }
      } catch { /* skip inaccessible dbs */ }
    }

    return NextResponse.json({
      serverStatus: {
        version:     serverStatus.version,
        uptime:      serverStatus.uptime,
        connections: serverStatus.connections,
        mem:         serverStatus.mem,
        opcounters:  serverStatus.opcounters,
      },
      dbStats: {
        collections:  totalCollections,
        objects:      totalObjects,
        avgObjSize:   avgObjSizeCount > 0 ? avgObjSizeSum / avgObjSizeCount : 0,
        dataSize:     totalDataSize,
        storageSize:  totalStorageSize,
        indexSize:    totalIndexSize,
      },
    });
  } catch (err) {
    console.error('Server stats error:', err);
    return NextResponse.json({ error: 'Failed to fetch server stats' }, { status: 500 });
  }
}
