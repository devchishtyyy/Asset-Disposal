'use strict';

const axios = require('axios');
const https = require('https');

// ── SAP Asset proxy (action-based routing) ───────────────────────────────────
const BTP_BASE_URL = process.env.BTP_PROXY_URL || 'https://devspace.test.apimanagement.eu10.hana.ondemand.com:443/asset/values';
const BTP_API_KEY  = process.env.BTP_API_KEY   || '';

// ── BTP Login iFlow (axios, Basic auth, DEV) ─────────────────────────────────
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: { 'Accept-Encoding': 'gzip, deflate' },
});

const LOGIN_CREDENTIAL = 'sb-14500df7-5c11-4f60-a289-951ab9b56e65!b379530|it-rt-integration-suite-q07hbh9w!b410603:e287accb-c183-4b15-abf9-36c43241f016$ftnvyFI2U3mk8bzyWY7vW4ioM2P0DvL8B5ljByzdApU=';
const LOGIN_URL        = 'https://integration-suite-q07hbh9w.it-cpi026-rt.cfapps.eu10-002.hana.ondemand.com/http/Login';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic BTP proxy call for SAP asset actions (?action= routing).
 */
async function callBtpProxy(action, payload) {
  const url = `${BTP_BASE_URL}?action=${encodeURIComponent(action)}`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };

  if (BTP_API_KEY) {
    headers['Authorization'] = `Bearer ${BTP_API_KEY}`;
  }

  let response;
  try {
    response = await axiosInstance.post(url, payload, {
      headers,
      timeout: 60000,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error('[BTP Proxy] Network error:', err.message);
    throw new Error('BTP_NETWORK_ERROR');
  }

  if (response.status === 401 || response.status === 403) throw new Error('BTP_UNAUTHORIZED');
  if (response.status === 404)                            throw new Error('BTP_NOT_FOUND');
  if (response.status >= 500) {
    console.error(`[BTP Proxy] HTTP ${response.status} error`);
    throw new Error('BTP_NETWORK_ERROR');
  }

  return response.data;
}

/**
 * Verify SAP credentials through BTP Integration Suite.
 */
async function verifySapCredentials(sapUser, sapPass) {
  try {
    const response = await callBtpProxy('sap/verify', { sapUser, sapPass });
    if (!response.ok) throw new Error('SAP_UNAUTHORIZED');
    return response;
  } catch (err) {
    if (err.message === 'BTP_UNAUTHORIZED')  throw new Error('SAP_UNAUTHORIZED');
    if (err.message === 'BTP_NETWORK_ERROR') throw new Error('SAP_NETWORK_ERROR');
    throw err;
  }
}

/**
 * Fetch asset details from SAP through BTP Integration Suite.
 */
async function fetchAssetFromSAP(assetNo, companyCode, sapUser, sapPass) {
  try {
    const response = await callBtpProxy('sap/asset', { assetNo, companyCode, sapUser, sapPass });

    if (!response.ok) {
      if (response.error === 'NOT_FOUND')    throw new Error('SAP_NOT_FOUND');
      if (response.error === 'UNAUTHORIZED') throw new Error('SAP_UNAUTHORIZED');
      throw new Error('SAP_NETWORK_ERROR');
    }

    const asset = response.data || response;
    return {
      plant:            asset.plant            || asset.EvPlant             || '',
      department:       asset.department       || asset.EvDepartment        || '',
      assetDescription: asset.assetDescription || asset.EvAssetDesc         || '',
      totalQuantity:    asset.totalQuantity    || asset.EvTotalQuantity     || '',
      yearOfPurchase:   asset.yearOfPurchase   || asset.EvYearOfPurchase    || '',
      cost:             asset.cost      != null ? String(asset.cost)      : (asset.EvAcquisitionValue != null ? String(asset.EvAcquisitionValue) : ''),
      bookValue:        asset.bookValue != null ? String(asset.bookValue) : (asset.EvBookValue        != null ? String(asset.EvBookValue)        : ''),
    };
  } catch (err) {
    if (err.message === 'BTP_NOT_FOUND')     throw new Error('SAP_NOT_FOUND');
    if (err.message === 'BTP_UNAUTHORIZED')  throw new Error('SAP_UNAUTHORIZED');
    if (err.message === 'BTP_NETWORK_ERROR') throw new Error('SAP_NETWORK_ERROR');
    throw err;
  }
}

/**
 * Login via BTP Integration Suite Login iFlow (DEV).
 * Uses axios + Basic auth + I_UNAME/I_PWD body — matches the handheld app pattern.
 */
async function loginWithSF(userId, password) {
  const authHeader = `Basic ${Buffer.from(LOGIN_CREDENTIAL).toString('base64')}`;

  let response;
  try {
    response = await axiosInstance.post(LOGIN_URL, {
      I_UNAME: userId,
      I_PWD:   password,
    }, {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authHeader,
      },
      timeout: 60000,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error('[BTP Login] Network error:', err.message);
    throw new Error('Unable to reach authentication service. Check your network and try again.');
  }

  const result = response.data?.['ns0:Z_WM_HANDHELD_LOGINResponse'];

  if (result?.E_TYPE !== 'S') {
    const msg = result?.E_MESSAGE || 'Authentication failed.';
    console.error('[BTP Login] Auth rejected:', msg);
    throw new Error(msg);
  }

  return {
    username:        userId,
    name:            result.E_FULLNAME || result.E_NAME || userId,
    sfAuthenticated: true,
    jobTitle:        result.E_JOB_TITLE    || result.E_JOBTITLE    || '',
    department:      result.E_DEPARTMENT   || result.E_DEPT        || '',
    businessUnit:    result.E_BUSINESS_UNIT || result.E_BU         || '',
    company:         result.E_COMPANY      || '',
  };
}

module.exports = {
  callBtpProxy,
  verifySapCredentials,
  fetchAssetFromSAP,
  loginWithSF,
};
