import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { verifyAdminPassword } from '@/src/lib/auth-db';
import { JWT_SECRET } from '@/src/lib/jwt';
import { isBlocked, recordFailedAttempt, resetAttempts } from '@/src/lib/rate-limit';
import { JWT_EXPIRATION, JWT_COOKIE_NAME, JWT_COOKIE_MAX_AGE } from '@/src/lib/constants';

function getIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: Request) {
  const ip = getIp(request);

  // 1. Rate-limit check BEFORE touching the database
  const limit = isBlocked(ip);
  if (limit.blocked) {
    const retryAfter = Math.ceil((limit.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${retryAfter}s.` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username || !password) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // 2. Verify credentials
    if (username !== 'admin' || !verifyAdminPassword(password)) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // 3. Success — clear failure counter, issue token
    resetAttempts(ip);

    const token = await new SignJWT({ username })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRATION)
      .sign(JWT_SECRET);

    const res = NextResponse.json({ success: true });
    res.cookies.set(JWT_COOKIE_NAME, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   JWT_COOKIE_MAX_AGE,
      path:     '/',
    });
    return res;

  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
