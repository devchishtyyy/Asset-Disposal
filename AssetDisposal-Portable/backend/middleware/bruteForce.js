'use strict';

// In-memory per-userId failure tracking. Resets on server restart (acceptable
// for this deployment model; a Redis store would be needed for multi-process).
//
// Map: userId -> { count, windowStart (ms), lockedUntil (ms|null) }
const attempts = new Map();

const MAX_FAILURES = 5;
const WINDOW_MS    = 15 * 60 * 1000; // sliding 15-min failure window
const LOCKOUT_MS   = 15 * 60 * 1000; // lockout duration after MAX_FAILURES

// Periodic cleanup of stale entries so memory doesn't grow unboundedly.
const _cleanup = setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of attempts) {
    const stale = data.lockedUntil
      ? now > data.lockedUntil
      : now - data.windowStart > WINDOW_MS;
    if (stale) attempts.delete(userId);
  }
}, 5 * 60 * 1000);
_cleanup.unref();

/**
 * Check whether a userId is currently locked out.
 * @param {string} userId
 * @returns {{ locked: boolean, remainingMs: number }}
 */
function checkLock(userId) {
  const data = attempts.get(userId);
  if (!data?.lockedUntil) return { locked: false, remainingMs: 0 };
  const remaining = data.lockedUntil - Date.now();
  if (remaining <= 0) {
    attempts.delete(userId);
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs: remaining };
}

/**
 * Record a failed login attempt for userId.
 * Returns the post-record lock state so callers know whether a lock was just applied.
 * @param {string} userId
 * @returns {{ locked: boolean, remainingMs: number }}
 */
function recordFailure(userId) {
  const now  = Date.now();
  const data = attempts.get(userId);

  if (!data || now - data.windowStart > WINDOW_MS) {
    attempts.set(userId, { count: 1, windowStart: now, lockedUntil: null });
    return { locked: false, remainingMs: 0 };
  }

  data.count++;
  if (data.count >= MAX_FAILURES) {
    data.lockedUntil = now + LOCKOUT_MS;
    return { locked: true, remainingMs: LOCKOUT_MS };
  }
  return { locked: false, remainingMs: 0 };
}

/**
 * Clear failure history after a successful login.
 * @param {string} userId
 */
function recordSuccess(userId) {
  attempts.delete(userId);
}

module.exports = { checkLock, recordFailure, recordSuccess };
