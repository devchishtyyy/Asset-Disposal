'use strict';

const jwt = require('jsonwebtoken');
const { isBlacklisted } = require('./tokenBlacklist');
const { isAdmin } = require('../db');

// empNo 10009671 is the master controller — hardcoded, cannot be demoted via API
const MASTER_ADMIN_EMP_NO = '10009671';
const SUPER_ADMIN_EMP_NO  = MASTER_ADMIN_EMP_NO; // backward-compat alias

/**
 * Express middleware — verifies the Bearer JWT in the Authorization header.
 * Attaches the decoded payload to req.user and the raw token string to req.token.
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
 * Middleware — restrict a route to any admin user.
 * Accepts the master admin (10009671) or any empNo stored in the admins table.
 */
function requireAdmin(req, res, next) {
  const empNo = req.user?.empNo;
  if (empNo === MASTER_ADMIN_EMP_NO || isAdmin(empNo)) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required.' });
}

/**
 * Middleware — restrict a route to the master admin only.
 * Used for operations that should never be delegated (e.g., granting/revoking admin rights).
 */
function requireMasterAdmin(req, res, next) {
  if (req.user?.empNo !== MASTER_ADMIN_EMP_NO) {
    return res.status(403).json({ error: 'Master admin access required.' });
  }
  next();
}

// Keep requireSuperAdmin as an alias so existing route imports don't break
const requireSuperAdmin = requireMasterAdmin;

module.exports = {
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  requireMasterAdmin,
  SUPER_ADMIN_EMP_NO,
  MASTER_ADMIN_EMP_NO,
};
