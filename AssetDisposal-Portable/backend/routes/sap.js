'use strict';

const express                       = require('express');
const { authenticate }              = require('../middleware/auth');
const { verifySapCredentials, fetchAssetFromSAP } = require('../services/sapProxy');

const router   = express.Router();
const SAP_MOCK = process.env.SAP_MOCK === 'true';

// POST /api/sap/verify — verify SAP credentials
router.post('/verify', authenticate, async (req, res) => {
  const { sapUser, sapPass } = req.body;
  if (!sapUser || !sapPass) {
    return res.status(400).json({ error: 'sapUser and sapPass are required.' });
  }

  if (SAP_MOCK) {
    console.info('[SAP Mock] verify — returning OK for user:', sapUser);
    return res.json({ ok: true, mock: true });
  }

  try {
    await verifySapCredentials(sapUser, sapPass);
    res.json({ ok: true });
  } catch (err) {
    if (err.message === 'SAP_UNAUTHORIZED') {
      return res.status(401).json({
        error: 'SAP_UNAUTHORIZED',
        detail: 'The upstream asset API rejected the request. Verify the SAP credentials or configured BTP auth token.',
      });
    }
    if (err.message === 'SAP_NETWORK_ERROR') {
      return res.status(502).json({
        error: 'SAP_NETWORK_ERROR',
        detail: 'The upstream asset API could not be reached or returned an unexpected response.',
      });
    }
    res.status(500).json({ error: 'SAP_NETWORK_ERROR' });
  }
});

// POST /api/sap/asset — look up an asset from SAP
router.post('/asset', authenticate, async (req, res) => {
  const { assetNo, companyCode, sapUser, sapPass } = req.body;
  if (!assetNo || !companyCode || !sapUser || !sapPass) {
    return res.status(400).json({ error: 'assetNo, companyCode, sapUser and sapPass are required.' });
  }

  if (SAP_MOCK) {
    console.info('[SAP Mock] asset lookup —', assetNo, '/', companyCode);
    return res.json({
      plant:            'MOCK-PLANT',
      department:       'Mock Department',
      assetDescription: `Mock Asset — ${assetNo}`,
      totalQuantity:    '1',
      yearOfPurchase:   '2021',
      cost:             '500000',
      bookValue:        '350000',
    });
  }

  try {
    const data = await fetchAssetFromSAP(assetNo, companyCode, sapUser, sapPass);
    res.json(data);
  } catch (err) {
    if (err.message === 'SAP_NOT_FOUND') {
      return res.status(404).json({ error: 'SAP_NOT_FOUND' });
    }
    if (err.message === 'SAP_UNAUTHORIZED') {
      return res.status(401).json({
        error: 'SAP_UNAUTHORIZED',
        detail: 'The upstream asset API rejected the request. Verify the SAP credentials or configured BTP auth token.',
      });
    }
    if (err.message === 'SAP_NETWORK_ERROR') {
      return res.status(502).json({
        error: 'SAP_NETWORK_ERROR',
        detail: 'The upstream asset API could not be reached or returned an unexpected response.',
      });
    }
    res.status(500).json({ error: 'SAP_NETWORK_ERROR' });
  }
});

module.exports = router;
