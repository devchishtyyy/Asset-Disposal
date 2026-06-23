'use strict';

const crypto = require('crypto');

// Map: sha256(tokenString) -> expiry timestamp (ms)
// Tokens are added on explicit logout and auto-purged once they would have expired anyway.
const blacklist = new Map();

// Purge expired entries every 10 minutes so memory doesn't grow unboundedly.
const _cleanup = setInterval(() => {
  const now = Date.now();
  for (const [hash, expiry] of blacklist) {
    if (expiry <= now) blacklist.delete(hash);
  }
}, 10 * 60 * 1000);
_cleanup.unref(); // Don't prevent the process from exiting cleanly.

function _hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Revoke a JWT until its natural expiry time.
 * Call this on logout so any copy of the token (e.g. in the browser's
 * sessionStorage) becomes immediately invalid server-side.
 *
 * @param {string} token - Raw JWT string
 * @param {number} exp   - JWT exp claim (Unix seconds)
 */
function blacklistToken(token, exp) {
  if (!token || !exp) return;
  blacklist.set(_hash(token), exp * 1000);
}

/**
 * Return true if the token has been explicitly revoked (logged out).
 * Expired blacklist entries are pruned lazily here and by the interval above.
 *
 * @param {string} token - Raw JWT string
 * @returns {boolean}
 */
function isBlacklisted(token) {
  const hash   = _hash(token);
  const expiry = blacklist.get(hash);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) {
    blacklist.delete(hash);
    return false;
  }
  return true;
}

module.exports = { blacklistToken, isBlacklisted };
