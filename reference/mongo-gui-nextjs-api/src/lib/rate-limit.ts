/**
 * In-memory rate limiter for the login endpoint.
 *
 * Tracks failed attempts per IP. After RATE_LIMIT_MAX_ATTEMPTS failures
 * within RATE_LIMIT_WINDOW_MS, further attempts are blocked until the
 * window expires.
 *
 * NOTE: this is process-local. For multi-instance deployments replace the
 * Map with a Redis-backed store (e.g. @upstash/ratelimit).
 */

import { RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS } from './constants';

interface Entry {
  attempts: number;
  resetAt:  number;
}

const store = new Map<string, Entry>();

// Prune expired entries every window to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS);

/** Check whether an IP is currently blocked (without recording a new attempt). */
export function isBlocked(ip: string): { blocked: boolean; retryAfterMs?: number } {
  const now   = Date.now();
  const entry = store.get(ip);
  if (!entry || entry.resetAt < now) return { blocked: false };
  if (entry.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { blocked: true, retryAfterMs: entry.resetAt - now };
  }
  return { blocked: false };
}

/** Record a failed login attempt for the given IP. */
export function recordFailedAttempt(ip: string): void {
  const now   = Date.now();
  const entry = store.get(ip);
  if (!entry || entry.resetAt < now) {
    store.set(ip, { attempts: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.attempts += 1;
  }
}

/** Clear the failure counter for an IP after a successful login. */
export function resetAttempts(ip: string): void {
  store.delete(ip);
}
