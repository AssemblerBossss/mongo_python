import Database from 'better-sqlite3';
import bcrypt   from 'bcryptjs';
import crypto   from 'crypto';
import chalk    from 'chalk';
import path     from 'path';
import fs       from 'fs';

/**
 * Resolve the SQLite database path.
 *
 * Priority:
 *   1. AUTH_DB_PATH env variable          (absolute path — recommended for prod)
 *   2. /var/lib/mongo-gui/auth.db          (Linux production default, out-of-webroot)
 *   3. <project-root>/auth.db              (dev fallback, shows a warning)
 */
function resolveDbPath(): string {
  if (process.env.AUTH_DB_PATH) return process.env.AUTH_DB_PATH;

  if (process.env.NODE_ENV === 'production') {
    const productionPath = '/var/lib/mongo-gui/auth.db';
    const dir = path.dirname(productionPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    return productionPath;
  }

  // Development fallback
  console.warn(
    '[WARN] auth.db is stored at project root. ' +
    'Set AUTH_DB_PATH to an out-of-webroot location in production.'
  );
  return path.join(process.cwd(), 'auth.db');
}

let db: Database.Database | undefined;

export function initAuthDb(): Database.Database {
  if (db) return db;

  // Resolve and create the auth database only when the application actually
  // needs it. Importing this module also happens during `next build`; doing
  // filesystem work at module scope made production builds require root access.
  const dbPath = resolveDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Restrict file to owner read/write only
  try { fs.chmodSync(dbPath, 0o600); } catch { /* ignore on Windows */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL
    )
  `);

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

  if (!existing) {
    const password = crypto.randomBytes(8).toString('hex'); // 16 hex chars
    const hash     = bcrypt.hashSync(password, 12);

    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);

    const W  = 60;
    const ln = '═'.repeat(W);
    const T  = ' MONGODB WEBGUI - INITIAL SETUP ';
    const p  = Math.floor((W - T.length) / 2);

    console.log('\n' + chalk.yellow.bold('╔' + ln + '╗'));
    console.log(chalk.yellow.bold('║' + ' '.repeat(p) + T + ' '.repeat(W - T.length - p) + '║'));
    console.log(chalk.yellow.bold('╠' + ln + '╣'));
    console.log(chalk.yellow.bold('║  An admin account has been automatically created.          ║'));
    console.log(chalk.yellow.bold('║  Save these credentials now — they will not be shown again.║'));
    console.log(chalk.yellow.bold('║                                                             ║'));
    console.log(chalk.yellow.bold('║    Username : ') + chalk.green.bold('admin') + chalk.yellow.bold(' '.repeat(W - 20) + '║'));
    console.log(chalk.yellow.bold('║    Password : ') + chalk.green.bold(password) + chalk.yellow.bold(' '.repeat(W - 20 - password.length + 5) + '║'));
    console.log(chalk.yellow.bold('║                                                             ║'));
    console.log(chalk.yellow.bold('║  Log in at: ') + chalk.blue('/login') + chalk.yellow.bold(' '.repeat(W - 21) + '║'));
    console.log(chalk.yellow.bold('╚' + ln + '╝') + '\n');
  }

  return db;
}

export function verifyAdminPassword(password: string): boolean {
  const database = initAuthDb();
  const user = database
    .prepare('SELECT password_hash FROM users WHERE username = ?')
    .get('admin') as { password_hash: string } | undefined;
  if (!user) return false;
  return bcrypt.compareSync(password, user.password_hash);
}
