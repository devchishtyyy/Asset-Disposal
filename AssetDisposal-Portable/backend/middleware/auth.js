'use strict';

const jwt = require('jsonwebtoken');
const { isBlacklisted } = require('./tokenBlacklist');

const SUPER_ADMIN_EMP_NO = '10009471';

/**
 * Express middleware — verifies the Bearer JWT in the Authorization header.
 * Attaches the decoded payload to req.user and the raw token string to req.token
 * (req.token is needed by the logout endpoint to blacklist the specific token).
 */
function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }
  const token = header.slice(7);

  // Fast-fail on explicitly revoked tokens (logged-out sessions).
  if (isBlacklisted(token)) {
    return res.status(401).json({ error: 'Token invalid or expired. Please log in again.' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured.');
    req.user  = jwt.verify(token, secret);
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid or expired. Please log in again.' });
  }
}

/**
 * Middleware — restrict a route to the super admin only.
 */
function requireSuperAdmin(req, res, next) {
  if (req.user?.empNo !== SUPER_ADMIN_EMP_NO) {
    return res.status(403).json({ error: 'Super admin access required.' });
  }
  next();
}

module.exports = { authenticate, requireSuperAdmin, SUPER_ADMIN_EMP_NO };
