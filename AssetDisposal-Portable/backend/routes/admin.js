'use strict';

const express = require('express');
const {
  authenticate,
  requireAdmin,
  requireMasterAdmin,
  MASTER_ADMIN_EMP_NO,
} = require('../middleware/auth');
const {
  loadAdminConfig,
  saveAdminConfig,
  getAdmins,
  addAdmin,
  removeAdmin,
} = require('../db');
const { isConfigured: emailConfigured } = require('../services/email');

const router = express.Router();

// GET /api/admin/config  — any authenticated user can read (needed for role resolution)
router.get('/config', authenticate, (req, res) => {
  const config = loadAdminConfig();
  res.json({ config, emailConfigured });
});

// PUT /api/admin/config  — any admin (master or delegated) can write
router.put('/config', authenticate, requireAdmin, (req, res) => {
  const config = req.body;
  if (!config || !config.companies) {
    return res.status(400).json({ error: 'Invalid config payload.' });
  }
  saveAdminConfig(config);
  res.json({ ok: true });
});

// ── Admin user management (master admin only) ───────────────────────────────────

// GET /api/admin/admins  — list all delegated admins
router.get('/admins', authenticate, requireMasterAdmin, (req, res) => {
  res.json({ admins: getAdmins() });
});

// POST /api/admin/admins  — grant admin access to an employee
router.post('/admins', authenticate, requireMasterAdmin, (req, res) => {
  const { empNo, name } = req.body;
  if (!empNo || typeof empNo !== 'string') {
    return res.status(400).json({ error: 'empNo is required.' });
  }
  if (empNo.trim() === MASTER_ADMIN_EMP_NO) {
    return res.status(400).json({ error: 'Master admin is already the top-level controller.' });
  }
  addAdmin(empNo.trim(), (name || '').trim(), req.user.empNo);
  res.json({ ok: true, empNo: empNo.trim() });
});

// DELETE /api/admin/admins/:empNo  — revoke admin access from an employee
router.delete('/admins/:empNo', authenticate, requireMasterAdmin, (req, res) => {
  const { empNo } = req.params;
  if (empNo === MASTER_ADMIN_EMP_NO) {
    return res.status(400).json({ error: 'Cannot revoke master admin access.' });
  }
  removeAdmin(empNo);
  res.json({ ok: true });
});

module.exports = router;
