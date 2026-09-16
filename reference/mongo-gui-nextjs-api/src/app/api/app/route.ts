import { NextResponse } from 'next/server';
import { APP_MODE, SYSTEM_DATABASES } from '@/src/lib/constants';

export async function GET() {
  return NextResponse.json({
    mode: APP_MODE === 'readonly' ? 'readonly' : 'full',
    readonly: APP_MODE === 'readonly',
    systemDatabases: SYSTEM_DATABASES,
  });
}
