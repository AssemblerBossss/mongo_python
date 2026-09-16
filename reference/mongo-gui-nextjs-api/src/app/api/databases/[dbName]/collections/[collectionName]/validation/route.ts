import { NextResponse } from 'next/server';
import clientPromise from '@/src/lib/mongodb';
import { assertNoDangerousOperators, blockSystemDatabaseWrite, ensureWritable } from '@/src/lib/api-guards';
import { MONGO_QUERY_MAX_TIME_MS } from '@/src/lib/constants';

type Params = { params: Promise<{ dbName: string; collectionName: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { dbName, collectionName } = await params;
    const client = await clientPromise;
    const collections = await client.db(dbName).listCollections({ name: collectionName }).toArray();
    const info = collections[0] as any;
    const options = info?.options ?? {};
    return NextResponse.json({
      validator: options.validator ?? {},
      validationLevel: options.validationLevel ?? 'off',
      validationAction: options.validationAction ?? 'error',
      raw: options,
    });
  } catch (err) {
    console.error('Validation GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch validation settings' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const readonly = ensureWritable();
  if (readonly) return readonly;

  try {
    const { dbName, collectionName } = await params;
    const systemBlocked = blockSystemDatabaseWrite(dbName);
    if (systemBlocked) return systemBlocked;

    const body = await request.json().catch(() => null) as {
      validator?: Record<string, unknown>;
      validationLevel?: 'off' | 'strict' | 'moderate';
      validationAction?: 'error' | 'warn';
    } | null;

    if (!body || typeof body !== 'object' || Array.isArray(body.validator)) {
      return NextResponse.json({ error: 'Invalid validation payload.' }, { status: 400 });
    }
    assertNoDangerousOperators(body.validator ?? {});

    const validationLevel = body.validationLevel ?? 'strict';
    const validationAction = body.validationAction ?? 'error';
    if (!['off', 'strict', 'moderate'].includes(validationLevel)) {
      return NextResponse.json({ error: 'Invalid validation level.' }, { status: 400 });
    }
    if (!['error', 'warn'].includes(validationAction)) {
      return NextResponse.json({ error: 'Invalid validation action.' }, { status: 400 });
    }

    const client = await clientPromise;
    await client.db(dbName).command({
      collMod: collectionName,
      validator: body.validator ?? {},
      validationLevel,
      validationAction,
      maxTimeMS: MONGO_QUERY_MAX_TIME_MS,
    });

    return NextResponse.json({ success: true, message: 'Validation updated.' });
  } catch (err) {
    console.error('Validation PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update validation settings' }, { status: 500 });
  }
}
