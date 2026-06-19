'use strict';

const express                        = require('express');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { loadAdminConfig, saveAdminConfig } = require('../db');
const { isConfigured: emailConfigured }    = require('../services/email');

const router = express.Router();

// GET /api/admin/config  — any authenticated user can read (needed for role resolution)
router.get('/config', authenticate, (req, res) => {
  const config = loadAdminConfig();
  res.json({ config, emailConfigured });
});

// PUT /api/admin/config  — super admin only
router.put('/config', authenticate, requireSuperAdmin, (req, res) => {
  const config = req.body;
  if (!config || !config.companies) {
    return res.status(400).json({ error: 'Invalid config payload.' });
  }
  saveAdminConfig(config);
  res.json({ ok: true });
});

module.exports = router;
