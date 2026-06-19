'use strict';

const jwt = require('jsonwebtoken');

const SUPER_ADMIN_EMP_NO = '10009471';

/**
 * Express middleware — verifies the Bearer JWT in the Authorization header.
 * Attaches the decoded payload to req.user.
 */
function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }
  const token = header.slice(7);
  try {
    const secret  = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured.');
    req.user = jwt.verify(token, secret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid or expired. Please log in again.' });
  }
}

/**
 * Middleware factory — restrict a route to the super admin only.
 */
function requireSuperAdmin(req, res, next) {
  if (req.user?.empNo !== SUPER_ADMIN_EMP_NO) {
    return res.status(403).json({ error: 'Super admin access required.' });
  }
  next();
}

module.exports = { authenticate, requireSuperAdmin, SUPER_ADMIN_EMP_NO };
