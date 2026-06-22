'use strict';

/**
 * BTP Integration Suite Proxy
 * Routes all SAP and SuccessFactors API calls through the SAP BTP Integration Suite
 * Central proxy endpoint: https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values
 */

const { fetch: undiciFetch } = require('undici');

const BTP_BASE_URL = process.env.BTP_PROXY_URL || 'https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values';
const BTP_API_KEY = process.env.BTP_API_KEY || '';

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
 * Login with SuccessFactors through BTP Integration Suite
 * @param {string} userId - User ID / Employee number
 * @param {string} password - User password
 */
async function loginWithSF(userId, password) {
  try {
    const response = await callBtpProxy('auth/login', {
      userId,
      password,
    });

    if (!response.ok) {
      throw new Error('Invalid credentials or authentication service unavailable.');
    }

    // Map response to expected format
    const userInfo = response.data || response;
    return {
      username:       userInfo.username       || userInfo.userId || userId,
      name:           userInfo.name           || userInfo.username || userId,
      sfAuthenticated: userInfo.sfAuthenticated !== false,
      jobTitle:       userInfo.jobTitle       || '',
      department:     userInfo.department     || '',
      businessUnit:   userInfo.businessUnit   || '',
      company:        userInfo.company        || '',
    };
  } catch (err) {
    if (err.message === 'BTP_UNAUTHORIZED') {
      throw new Error('Invalid SuccessFactors credentials. Please try again.');
    }
    if (err.message === 'BTP_NETWORK_ERROR') {
      throw new Error('Unable to reach authentication service. Check your network and try again.');
    }
    throw err;
  }
}

module.exports = {
  callBtpProxy,
  verifySapCredentials,
  fetchAssetFromSAP,
  loginWithSF,
};
