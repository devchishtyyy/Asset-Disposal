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

// ── SAP asset lookup — API Management OData proxy ────────────────────────────
const SAP_BASE_URL = process.env.BTP_PROXY_URL || 'https://devspace.test.apimanagement.eu10.hana.ondemand.com:443/asset/values';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Portal login via SuccessFactors OData API.
 * Appends @packagesli to userId for Basic Auth.
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
 * Verify SAP credentials against the API Management proxy.
 * A successful GET (200) confirms the credentials are valid.
 */
async function verifySapCredentials(sapUser, sapPass) {
  const authHeader = `Basic ${Buffer.from(`${sapUser}:${sapPass}`).toString('base64')}`;

  let response;
  try {
    response = await axiosInstance.get(SAP_BASE_URL, {
      headers: { 'Authorization': authHeader },
      timeout: 30000,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error('[SAP Verify] Network error:', err.message);
    throw new Error('SAP_NETWORK_ERROR');
  }

  if (response.status === 401 || response.status === 403) throw new Error('SAP_UNAUTHORIZED');
  if (response.status >= 400) {
    console.error('[SAP Verify] HTTP error:', response.status);
    throw new Error('SAP_NETWORK_ERROR');
  }

  return { ok: true };
}

/**
 * Fetch asset details from SAP via the API Management OData proxy.
 * Asset number is zero-padded to 12 digits as required by the SAP entity key.
 */
async function fetchAssetFromSAP(assetNo, companyCode, sapUser, sapPass) {
  const authHeader  = `Basic ${Buffer.from(`${sapUser}:${sapPass}`).toString('base64')}`;
  const paddedAsset = String(assetNo).padStart(12, '0');
  const url = `${SAP_BASE_URL}/AssetDetailSet(IvAssetNumber='${paddedAsset}',IvCompanyCode='${companyCode}')?sap-client=110&$format=json`;

  let response;
  try {
    response = await axiosInstance.get(url, {
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
      timeout: 30000,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error('[SAP Asset] Network error:', err.message);
    throw new Error('SAP_NETWORK_ERROR');
  }

  if (response.status === 401 || response.status === 403) throw new Error('SAP_UNAUTHORIZED');
  if (response.status === 404)                            throw new Error('SAP_NOT_FOUND');
  if (response.status >= 400) {
    console.error('[SAP Asset] HTTP error:', response.status, JSON.stringify(response.data));
    throw new Error('SAP_NETWORK_ERROR');
  }

  const asset = response.data?.d;
  if (!asset) throw new Error('SAP_NETWORK_ERROR');

  return {
    plant:            asset.EvPlant            || '',
    department:       asset.EvDepartment       || '',
    assetDescription: asset.EvAssetDesc        || '',
    totalQuantity:    asset.EvTotalQuantity    != null ? String(asset.EvTotalQuantity)    : '',
    yearOfPurchase:   asset.EvYearOfPurchase   || '',
    cost:             asset.EvAcquisitionValue != null ? String(asset.EvAcquisitionValue) : '',
    bookValue:        asset.EvBookValue        != null ? String(asset.EvBookValue)        : '',
  };
}

module.exports = {
  verifySapCredentials,
  fetchAssetFromSAP,
  loginWithSF,
};
