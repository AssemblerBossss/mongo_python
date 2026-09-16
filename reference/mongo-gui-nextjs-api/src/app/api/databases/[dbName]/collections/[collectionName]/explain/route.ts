import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { assertValidSort, boundedInteger, safeJsonObject } from '@/src/lib/api-guards';
import { MAX_PAGE_SIZE, MONGO_QUERY_MAX_TIME_MS } from '@/src/lib/constants';

type Params = { params: Promise<{ dbName: string; collectionName: string }> };

function objectFromBody(value: unknown) {
  return typeof value === 'string'
    ? safeJsonObject(value, {})
    : safeJsonObject(JSON.stringify(value ?? {}), {});
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { dbName, collectionName } = await params;
    const body = await request.json().catch(() => null) as {
      filter?: unknown;
      projection?: unknown;
      sort?: unknown;
      limit?: number;
    } | null;

    const filter = objectFromBody(body?.filter);
    const projection = objectFromBody(body?.projection);
    const sort = objectFromBody(body?.sort);
    assertValidSort(sort);
    const limit = boundedInteger(body?.limit, 50, 1, MAX_PAGE_SIZE);

    const client = await clientPromise;
    const explain = await client
      .db(dbName)
      .collection(collectionName)
      .find(filter, { maxTimeMS: MONGO_QUERY_MAX_TIME_MS })
      .project(projection)
      .sort(sort as Record<string, 1 | -1>)
      .limit(limit)
      .explain('executionStats');

    const stats = explain.executionStats ?? {};
    const winningPlan = explain.queryPlanner?.winningPlan ?? {};
    const planAsText = JSON.stringify(winningPlan);

    return NextResponse.json({
      summary: {
        executionTimeMillis: stats.executionTimeMillis ?? 0,
        nReturned: stats.nReturned ?? 0,
        totalDocsExamined: stats.totalDocsExamined ?? 0,
        totalKeysExamined: stats.totalKeysExamined ?? 0,
        isCollectionScan: planAsText.includes('COLLSCAN'),
      },
      explain,
    });
  } catch (err) {
    console.error('Explain error:', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to run explain plan' }, { status: 400 });
  }
}
