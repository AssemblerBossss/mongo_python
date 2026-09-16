/**
 * Next.js instrumentation hook — runs once at server startup (Node.js runtime only).
 * Correct place for server-side singleton initialization.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate JWT_SECRET early — crashes the server if missing/too short
    await import('./lib/jwt');

    // Initialize SQLite auth DB and create the admin user if needed
    const { initAuthDb } = await import('./lib/auth-db');
    try {
      initAuthDb();
    } catch (err) {
      console.error('[FATAL] Failed to initialize auth database:', err);
      process.exit(1);
    }
  }
}
