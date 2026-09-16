import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { initAuthDb } from '@/src/lib/auth-db';
import { JWT_SECRET } from '@/src/lib/jwt';
import { JWT_COOKIE_NAME } from '@/src/lib/constants';

interface AuthUser {
  id:            number;
  username:      string;
  password_hash: string;
}

export async function PATCH(request: Request) {
  try {
    // 1. Verify session via Next.js cookies API (handles "=" chars in JWT correctly)
    const cookieStore = await cookies();
    const token = cookieStore.get(JWT_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      await jwtVerify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // 2. Validate body
    const body = await request.json().catch(() => null);
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword     = typeof body?.newPassword     === 'string' ? body.newPassword     : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    // 3. Verify current password
    const db   = initAuthDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as AuthUser | undefined;

    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
    }

    // 4. Save new password hash
    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(newHash, 'admin');

    // 5. Expire session cookie — user must re-login
    const res = NextResponse.json({ success: true, message: 'Password updated. Please log in again.' });
    res.cookies.set(JWT_COOKIE_NAME, '', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires:  new Date(0),
      path:     '/',
    });
    return res;

  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
