'use strict';

/**
 * Dev-only routes — disabled in production.
 * Allows seeding the database with test data without being logged in,
 * mirroring the old "Seed test data" button on the login page.
 */

const express = require('express');
const { saveAdminConfig, buildTestAdminConfig } = require('../db');

const router = express.Router();

router.post('/seed', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found.' });
  }
  saveAdminConfig(buildTestAdminConfig());
  res.json({ ok: true, message: 'Test data seeded successfully.' });
});

module.exports = router;
