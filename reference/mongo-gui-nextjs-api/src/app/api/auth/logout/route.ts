import { NextResponse } from 'next/server';
import { JWT_COOKIE_NAME } from '@/src/lib/constants';

/**
 * POST /api/auth/logout
 * Expires the auth cookie server-side.
 * The middleware already guards all routes, so there is no JWT blacklist needed
 * for a single-user tool — expiring the cookie is sufficient.
 */
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(JWT_COOKIE_NAME, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires:  new Date(0),
    path:     '/',
  });
  return res;
}
