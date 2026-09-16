import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { JWT_COOKIE_NAME } from './lib/constants';

const raw = process.env.JWT_SECRET;
if (!raw) throw new Error('[FATAL] JWT_SECRET is not set.');
const JWT_SECRET = new TextEncoder().encode(raw);

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';

  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' blob:`
    : `script-src 'self' 'nonce-${nonce}' blob:`;

  return [
    "default-src 'self'",
    scriptSrc,
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    // Radix/React components may use inline style attributes for positioning.
    // This is less risky than allowing unsafe inline scripts and avoids a broken UI.
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

function withSecurityHeaders(response: NextResponse, csp: string, nonce: string) {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/logout')
  ) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    return withSecurityHeaders(response, csp, nonce);
  }

  const token = request.cookies.get(JWT_COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        csp,
        nonce
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const response = NextResponse.redirect(url);
    return withSecurityHeaders(response, csp, nonce);
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    return withSecurityHeaders(response, csp, nonce);
  } catch {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
      response.cookies.delete(JWT_COOKIE_NAME);
      return withSecurityHeaders(response, csp, nonce);
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const response = NextResponse.redirect(url);
    return withSecurityHeaders(response, csp, nonce);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|monaco/).*)'],
};
