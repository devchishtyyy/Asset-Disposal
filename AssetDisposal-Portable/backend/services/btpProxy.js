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
const SAP_ASSET_ENDPOINT_URL = process.env.SAP_ASSET_ENDPOINT_URL || 'https://prdspace.prod01.apimanagement.eu10.hana.ondemand.com/10/assets/AssetDetailSet';
const SAP_ASSET_USERNAME = process.env.SAP_ASSET_USERNAME || process.env.SAP_API_USERNAME || process.env.SAP_USERNAME || 'FF_IT3P_1724';
const SAP_ASSET_PASSWORD = process.env.SAP_ASSET_PASSWORD || process.env.SAP_API_PASSWORD || process.env.SAP_PASSWORD || '';
const BTP_API_KEY = process.env.BTP_API_KEY || '';
const BTP_AUTH_TOKEN = process.env.BTP_AUTH_TOKEN || process.env.BTP_TOKEN || '';

function normalizeAssetPayload(payload) {
  const candidates = [];
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload)) {
      candidates.push(...payload);
    } else {
      candidates.push(payload);
      if (payload.d) candidates.push(payload.d);
      if (payload.value) candidates.push(payload.value);
      if (payload.results) candidates.push(payload.results);
      if (payload.asset) candidates.push(payload.asset);
      if (payload.data) candidates.push(payload.data);
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
function resolveSapCredentials(sapUser, sapPass) {
  return {
    username: sapUser || SAP_ASSET_USERNAME || '',
    password: sapPass || SAP_ASSET_PASSWORD || '',
  };
}

function buildAssetDetailUrl(assetNo, companyCode) {
  const assetNumber = String(assetNo ?? '').trim();
  return `${SAP_ASSET_ENDPOINT_URL}(IvAssetNumber='${assetNumber}',IvCompanyCode='${companyCode}')`;
}

function buildProxyRequestConfig(sapUser, sapPass) {
  const { username, password } = resolveSapCredentials(sapUser, sapPass);
  const config = {
    timeout: 30000,
    validateStatus: () => true,
    headers: { Accept: 'application/json' },
  };

  if (BTP_AUTH_TOKEN) {
    config.headers.Authorization = `Bearer ${BTP_AUTH_TOKEN}`;
  } else {
    config.headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  if (BTP_API_KEY) {
    config.headers['x-api-key'] = BTP_API_KEY;
  }

  return config;
}

async function verifySapCredentials(sapUser, sapPass) {
  const requestConfig = buildProxyRequestConfig(sapUser, sapPass);

  let response;
  try {
    response = await axiosInstance.get(SAP_ASSET_ENDPOINT_URL, requestConfig);
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
  const url = buildAssetDetailUrl(assetNo, companyCode);
  const requestConfig = buildProxyRequestConfig(sapUser, sapPass);

  let response;
  try {
    response = await axiosInstance.get(url, requestConfig);
  } catch (err) {
    console.error('[SAP Asset] Network error:', err.message);
    throw new Error('SAP_NETWORK_ERROR');
  }

  if (response.status === 400) {
    console.error('[SAP Asset] Bad keys:', JSON.stringify(response.data));
    throw new Error('SAP_BAD_KEYS');
  }
  if (response.status === 401 || response.status === 403) {
    console.warn('[SAP Asset] Remote endpoint rejected the request', response.status, JSON.stringify(response.data));
    throw new Error('SAP_UNAUTHORIZED');
  }
  if (response.status === 404) {
    throw new Error('SAP_NOT_FOUND');
  }
  if (response.status >= 400) {
    console.error('[SAP Asset] HTTP error:', response.status, JSON.stringify(response.data));
    throw new Error('SAP_NETWORK_ERROR');
  }

  const normalized = normalizeAssetPayload(response.data);
  if (!normalized.assetDescription && !normalized.plant && !normalized.cost && !normalized.yearOfPurchase && !normalized.bookValue) {
    throw new Error('SAP_NETWORK_ERROR');
  }

  return normalized;
}

module.exports = {
  verifySapCredentials,
  fetchAssetFromSAP,
  loginWithSF,
  normalizeAssetPayload,
  buildAssetDetailUrl,
  buildProxyRequestConfig,
};
