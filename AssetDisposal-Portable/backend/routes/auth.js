'use strict';

const express   = require('express');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { loginWithSF }        = require('../services/sfProxy');
const { SUPER_ADMIN_EMP_NO, authenticate } = require('../middleware/auth');
const { blacklistToken }     = require('../middleware/tokenBlacklist');
const { checkLock, recordFailure, recordSuccess } = require('../middleware/bruteForce');

const router = express.Router();

// Dev test accounts — mirrors frontend sfAuth.js
const DEV_TEST_ACCOUNTS = {
  '10009471': { username: '10009471', name: 'Super Admin',         sfAuthenticated: false },
  'T001':     { username: 'T001',     name: 'Test Initiator',       sfAuthenticated: false },
  'T010':     { username: 'T010',     name: 'Test Dept Incharge',   sfAuthenticated: false },
  'T011':     { username: 'T011',     name: 'Test Finance',         sfAuthenticated: false },
  'T012':     { username: 'T012',     name: 'Test Biz Controller',  sfAuthenticated: false },
  'T013':     { username: 'T013',     name: 'Test BU Head',         sfAuthenticated: false },
  'T014':     { username: 'T014',     name: 'Test Waste Sale',      sfAuthenticated: false },
  'T015':     { username: 'T015',     name: 'Test Fin Controller',  sfAuthenticated: false },
  'T016':     { username: 'T016',     name: 'Test CFO',             sfAuthenticated: false },
  'T017':     { username: 'T017',     name: 'Test CEO',             sfAuthenticated: false },
};
const DEV_PASSWORD = 'test123';

// Rate-limit login attempts (IP-based; brute force module handles per-userId locking)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      20,
  message:  { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

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

  const secret  = process.env.JWT_SECRET;
  const expires = process.env.JWT_EXPIRES_IN || '8h';
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set.' });
  }

  const payload = {
    empNo:           userInfo.username,
    name:            userInfo.name || userInfo.username,
    sfAuthenticated: userInfo.sfAuthenticated,
    jobTitle:        userInfo.jobTitle        || '',
    department:      userInfo.department      || '',
    businessUnit:    userInfo.businessUnit    || '',
  };

  const token = jwt.sign(payload, secret, { expiresIn: expires });

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
    },
  });
});

module.exports = router;
