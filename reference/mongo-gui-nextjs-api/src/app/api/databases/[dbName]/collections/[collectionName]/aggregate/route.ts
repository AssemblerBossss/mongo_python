import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { assertNoDangerousOperators, boundedInteger, safeJsonArray } from '@/src/lib/api-guards';
import { MAX_AGGREGATION_STAGES, MAX_PAGE_SIZE, MONGO_QUERY_MAX_TIME_MS } from '@/src/lib/constants';

type Params = { params: Promise<{ dbName: string; collectionName: string }> };

const blockedWriteStages = new Set(['$out', '$merge']);

function validatePipeline(pipeline: unknown[]) {
  if (pipeline.length > MAX_AGGREGATION_STAGES) {
    throw new Error(`Pipeline limited to ${MAX_AGGREGATION_STAGES} stages.`);
  }
  for (const stage of pipeline) {
    if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
      throw new Error('Each aggregation stage must be a JSON object.');
    }
    const keys = Object.keys(stage);
    if (keys.length !== 1) throw new Error('Each aggregation stage must contain exactly one operator.');
    if (blockedWriteStages.has(keys[0])) throw new Error(`${keys[0]} is disabled in the WebGUI for safety.`);
  }
  assertNoDangerousOperators(pipeline);
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { dbName, collectionName } = await params;
    const body = await request.json().catch(() => null) as { pipeline?: unknown[]; limit?: number } | null;
    const pipeline = safeJsonArray(body?.pipeline ?? []);
    validatePipeline(pipeline);

    const limit = boundedInteger(body?.limit, 50, 1, MAX_PAGE_SIZE);
    const previewPipeline = [...pipeline, { $limit: limit }];

    const client = await clientPromise;
    const documents = await client
      .db(dbName)
      .collection(collectionName)
      .aggregate(previewPipeline, { maxTimeMS: MONGO_QUERY_MAX_TIME_MS, allowDiskUse: false })
      .toArray();

    return NextResponse.json({ documents, count: documents.length, limit });
  } catch (err) {
    console.error('Aggregation error:', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to run aggregation' }, { status: 400 });
  }
}
