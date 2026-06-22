'use strict';

const express  = require('express');
const jwt      = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { loginWithSF }        = require('../services/sfProxy');
const { SUPER_ADMIN_EMP_NO } = require('../middleware/auth');

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

// Rate-limit login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      20,
  message:  { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ error: 'userId and password are required.' });
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
    return res.status(401).json({ error: err.message || 'Authentication failed.' });
  }

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

module.exports = router;
