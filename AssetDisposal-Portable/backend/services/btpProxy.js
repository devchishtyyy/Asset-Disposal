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
const SAP_BASE_URL = process.env.BTP_PROXY_URL || 'https://prdspace.prod01.apimanagement.eu10.hana.ondemand.com/10/assets';
const BTP_API_KEY = process.env.BTP_API_KEY || '';

function normalizeAssetPayload(payload) {
  const candidates = [];
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload)) {
      candidates.push(...payload);
    } else {
      candidates.push(payload);
      if (payload.d) candidates.push(payload.d);
      if (payload.value) candidates.push(payload.value);
    }
  }

  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const normalized = {
      plant: item.plant || item.Plant || item.EvPlant || '',
      department: item.department || item.Department || item.EvDepartment || '',
      assetDescription: item.assetDescription || item.AssetDescription || item.EvAssetDesc || item.description || item.Description || '',
      totalQuantity: item.totalQuantity != null ? String(item.totalQuantity) : (item.TotalQuantity != null ? String(item.TotalQuantity) : (item.EvTotalQuantity != null ? String(item.EvTotalQuantity) : (item.quantity != null ? String(item.quantity) : ''))),
      yearOfPurchase: item.yearOfPurchase != null ? String(item.yearOfPurchase) : (item.YearOfPurchase != null ? String(item.YearOfPurchase) : (item.EvYearOfPurchase != null ? String(item.EvYearOfPurchase) : (item.purchaseYear != null ? String(item.purchaseYear) : ''))),
      cost: item.cost != null ? String(item.cost) : (item.Cost != null ? String(item.Cost) : (item.EvAcquisitionValue != null ? String(item.EvAcquisitionValue) : (item.acquisitionValue != null ? String(item.acquisitionValue) : ''))),
      bookValue: item.bookValue != null ? String(item.bookValue) : (item.BookValue != null ? String(item.BookValue) : (item.EvBookValue != null ? String(item.EvBookValue) : '')),
    };

    if (normalized.assetDescription || normalized.plant || normalized.cost || normalized.bookValue) {
      return normalized;
    }
  }

  return {
    plant: '',
    department: '',
    assetDescription: '',
    totalQuantity: '',
    yearOfPurchase: '',
    cost: '',
    bookValue: '',
  };
}

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
  const headers = {
    'Authorization': authHeader,
    'Accept': 'application/json',
    ...(BTP_API_KEY ? { 'x-api-key': BTP_API_KEY } : {}),
  };

  let response;
  try {
    response = await axiosInstance.get(SAP_BASE_URL, {
      headers,
      timeout: 30000,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error('[SAP Verify] Network error:', err.message);
    throw new Error('SAP_NETWORK_ERROR');
  }

  if (response.status === 401 || response.status === 403) throw new Error('SAP_UNAUTHORIZED');
  if (response.status >= 400) {
    console.error('[SAP Verify] HTTP error:', response.status, JSON.stringify(response.data));
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
  const params = new URLSearchParams({
    assetNumber: paddedAsset,
    companyCode,
    sapUser,
    sapPass,
  });
  const url = `${SAP_BASE_URL}?${params.toString()}`;

  let response;
  try {
    response = await axiosInstance.get(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        ...(BTP_API_KEY ? { 'x-api-key': BTP_API_KEY } : {}),
      },
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

  const normalized = normalizeAssetPayload(response.data);

  if (!normalized.assetDescription && !normalized.plant && !normalized.cost) {
    throw new Error('SAP_NETWORK_ERROR');
  }

  return normalized;
}

module.exports = {
  verifySapCredentials,
  fetchAssetFromSAP,
  loginWithSF,
  normalizeAssetPayload,
};
