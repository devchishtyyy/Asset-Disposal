'use strict';

const axios = require('axios');
const https = require('https');

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: { 'Accept-Encoding': 'gzip, deflate' },
});

// ── Portal login — SuccessFactors OData ──────────────────────────────────────
const SF_AUTH_URL   = 'https://api44.sapsf.com/odata/v2/Background_Community?$top=20';
const SF_COMPANY_ID = 'packagesli';

// ── SAP asset proxy — API Management ─────────────────────────────────────────
const BTP_BASE_URL = process.env.BTP_PROXY_URL || 'https://devspace.test.apimanagement.eu10.hana.ondemand.com:443/asset/values';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Portal login via SuccessFactors OData API.
 * Appends @packagesli to userId for Basic Auth, validates against SF.
 */
async function loginWithSF(userId, password) {
  const authHeader = `Basic ${Buffer.from(`${userId}@${SF_COMPANY_ID}:${password}`).toString('base64')}`;

  let response;
  try {
    response = await axiosInstance.get(SF_AUTH_URL, {
      headers: { 'Authorization': authHeader },
      timeout: 30000,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error('[SF Auth] Network error:', err.message);
    throw new Error('Unable to reach authentication service. Check your network and try again.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Invalid credentials. Please check your Employee Number and SuccessFactors password.');
  }
  if (response.status >= 400) {
    console.error('[SF Auth] Unexpected status:', response.status);
    throw new Error('Authentication service unavailable. Please try again later.');
  }

  return {
    username:        userId,
    name:            userId,
    sfAuthenticated: true,
    jobTitle:        '',
    department:      '',
    businessUnit:    '',
    company:         '',
  };
}

/**
 * Calls the SAP API Management proxy.
 * SAP user credentials are passed as HTTP Basic Auth — the proxy forwards them to SAP.
 */
async function callBtpProxy(action, payload, sapUser, sapPass) {
  const url        = `${BTP_BASE_URL}?action=${encodeURIComponent(action)}`;
  const authHeader = `Basic ${Buffer.from(`${sapUser}:${sapPass}`).toString('base64')}`;

  let response;
  try {
    response = await axiosInstance.post(url, payload, {
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Authorization': authHeader,
      },
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
 * Verify SAP credentials against the API Management proxy.
 */
async function verifySapCredentials(sapUser, sapPass) {
  try {
    const response = await callBtpProxy('sap/verify', { sapUser, sapPass }, sapUser, sapPass);
    if (!response.ok) throw new Error('SAP_UNAUTHORIZED');
    return response;
  } catch (err) {
    if (err.message === 'BTP_UNAUTHORIZED')  throw new Error('SAP_UNAUTHORIZED');
    if (err.message === 'BTP_NETWORK_ERROR') throw new Error('SAP_NETWORK_ERROR');
    throw err;
  }
}

/**
 * Fetch asset details from SAP via the API Management proxy.
 */
async function fetchAssetFromSAP(assetNo, companyCode, sapUser, sapPass) {
  try {
    const response = await callBtpProxy('sap/asset', { assetNo, companyCode, sapUser, sapPass }, sapUser, sapPass);

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

module.exports = {
  callBtpProxy,
  verifySapCredentials,
  fetchAssetFromSAP,
  loginWithSF,
};
