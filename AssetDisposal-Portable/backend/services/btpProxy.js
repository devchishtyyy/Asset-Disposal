'use strict';

const { fetch: undiciFetch } = require('undici');
const axios = require('axios');
const https = require('https');

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const BTP_BASE_URL = process.env.BTP_PROXY_URL || 'https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values';
const BTP_API_KEY  = process.env.BTP_API_KEY   || '';

const SAP_CREDENTIALS = {
  dev: process.env.BTP_LOGIN_CREDENTIALS_DEV || '',
  prd: process.env.BTP_LOGIN_CREDENTIALS_PRD || '',
};

const LOGIN_URLS = {
  dev: process.env.BTP_LOGIN_URL_DEV || 'https://integration-suite-q07hbh9w.it-cpi026-rt.cfapps.eu10-002.hana.ondemand.com/http/Login',
  prd: process.env.BTP_LOGIN_URL_PRD || 'https://integration-suite-prd-ud55bnea.it-cpi026-rt.cfapps.eu10-002.hana.ondemand.com/http/Login',
};

/**
 * Generic BTP proxy call
 * Sends request to Integration Suite with proper headers and authentication
 * @param {string} action - The action to perform (verify, asset, login, etc.)
 * @param {object} payload - Request payload
 * @returns {Promise<object>} - Response from BTP Integration Suite
 */
async function callBtpProxy(action, payload) {
  const url = `${BTP_BASE_URL}?action=${encodeURIComponent(action)}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Add API Key if configured
  if (BTP_API_KEY) {
    headers['Authorization'] = `Bearer ${BTP_API_KEY}`;
  }

  let res;
  try {
    res = await undiciFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[BTP Proxy] Network error:', err.message);
    throw new Error('BTP_NETWORK_ERROR');
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('BTP_UNAUTHORIZED');
  }
  if (res.status === 404) {
    throw new Error('BTP_NOT_FOUND');
  }
  if (!res.ok) {
    console.error(`[BTP Proxy] HTTP ${res.status} error`);
    throw new Error('BTP_NETWORK_ERROR');
  }

  try {
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[BTP Proxy] JSON parse error:', err.message);
    throw new Error('BTP_NETWORK_ERROR');
  }
}

/**
 * Verify SAP credentials through BTP Integration Suite
 * @param {string} sapUser - SAP username
 * @param {string} sapPass - SAP password
 */
async function verifySapCredentials(sapUser, sapPass) {
  try {
    const response = await callBtpProxy('sap/verify', {
      sapUser,
      sapPass,
    });
    
    if (!response.ok) {
      throw new Error('SAP_UNAUTHORIZED');
    }
    
    return response;
  } catch (err) {
    if (err.message === 'BTP_UNAUTHORIZED') throw new Error('SAP_UNAUTHORIZED');
    if (err.message === 'BTP_NETWORK_ERROR') throw new Error('SAP_NETWORK_ERROR');
    throw err;
  }
}

/**
 * Fetch asset details from SAP through BTP Integration Suite
 * @param {string} assetNo - Asset number
 * @param {string} companyCode - Company code
 * @param {string} sapUser - SAP username
 * @param {string} sapPass - SAP password
 */
async function fetchAssetFromSAP(assetNo, companyCode, sapUser, sapPass) {
  try {
    const response = await callBtpProxy('sap/asset', {
      assetNo,
      companyCode,
      sapUser,
      sapPass,
    });

    if (!response.ok) {
      if (response.error === 'NOT_FOUND') {
        throw new Error('SAP_NOT_FOUND');
      }
      if (response.error === 'UNAUTHORIZED') {
        throw new Error('SAP_UNAUTHORIZED');
      }
      throw new Error('SAP_NETWORK_ERROR');
    }

    // Map response fields if needed
    const asset = response.data || response;
    return {
      plant:            asset.plant            || asset.EvPlant          || '',
      department:       asset.department       || asset.EvDepartment     || '',
      assetDescription: asset.assetDescription || asset.EvAssetDesc      || '',
      totalQuantity:    asset.totalQuantity    || asset.EvTotalQuantity  || '',
      yearOfPurchase:   asset.yearOfPurchase   || asset.EvYearOfPurchase || '',
      cost:             asset.cost != null ? String(asset.cost) : (asset.EvAcquisitionValue != null ? String(asset.EvAcquisitionValue) : ''),
      bookValue:        asset.bookValue != null ? String(asset.bookValue) : (asset.EvBookValue != null ? String(asset.EvBookValue) : ''),
    };
  } catch (err) {
    if (err.message === 'BTP_NOT_FOUND') throw new Error('SAP_NOT_FOUND');
    if (err.message === 'BTP_UNAUTHORIZED') throw new Error('SAP_UNAUTHORIZED');
    if (err.message === 'BTP_NETWORK_ERROR') throw new Error('SAP_NETWORK_ERROR');
    throw err;
  }
}

/**
 * Login via BTP Integration Suite Login iFlow.
 * Mirrors the pattern used in the handheld app (axios + Basic Auth + I_UNAME/I_PWD).
 * @param {string} userId - Employee number
 * @param {string} password - SAP/SF password
 * @param {string} [environment] - 'prd' | '300' for production, anything else = dev
 */
async function loginWithSF(userId, password, environment) {
  const env = (environment === 'prd' || environment === '300') ? 'prd' : 'dev';
  const apiUrl     = LOGIN_URLS[env];
  const credentials = SAP_CREDENTIALS[env];

  if (!credentials) {
    console.error(`[BTP Login] BTP_LOGIN_CREDENTIALS_${env.toUpperCase()} is not configured`);
    throw new Error('Unable to reach authentication service. Check your network and try again.');
  }

  const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

  let response;
  try {
    response = await axiosInstance.post(apiUrl, {
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

  const sapResponse = response.data;
  const result = sapResponse?.['ns0:Z_WM_HANDHELD_LOGINResponse'];

  if (result?.E_TYPE !== 'S') {
    const msg = result?.E_MESSAGE || 'Authentication failed';
    console.error('[BTP Login] Auth rejected:', msg);
    throw new Error(msg);
  }

  return {
    username:        userId,
    name:            result.E_FULLNAME || result.E_NAME || userId,
    sfAuthenticated: true,
    jobTitle:        result.E_JOB_TITLE   || result.E_JOBTITLE   || '',
    department:      result.E_DEPARTMENT  || result.E_DEPT        || '',
    businessUnit:    result.E_BUSINESS_UNIT || result.E_BU        || '',
    company:         result.E_COMPANY     || '',
  };
}

module.exports = {
  callBtpProxy,
  verifySapCredentials,
  fetchAssetFromSAP,
  loginWithSF,
};
