'use strict';

/**
 * SAP ERP / S4HANA proxy.
 * Proxies asset lookup OData calls server-side so the browser never
 * speaks directly to SAP and credentials are not exposed in browser DevTools.
 *
 * SAP servers often use self-signed / internal CA certificates.
 * We replicate the old Vite proxy "secure: false" behaviour by using
 * a custom undici Agent with rejectUnauthorized: false, scoped only
 * to SAP requests.
 */

const { Agent, fetch: undiciFetch } = require('undici');

const SAP_BASE_URL   = process.env.SAP_BASE_URL   || 'https://vhpctds4ci.sap.packagesgroup.com:44300';
const SAP_CLIENT     = process.env.SAP_CLIENT      || '110';
const SAP_ODATA_PATH = '/sap/opu/odata/sap/ZASSET_WRITEOFF_SRV_SRV';

// Mirrors the old Vite proxy "secure: false" — only used for SAP traffic
const sapAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

function basicAuth(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

/**
 * Verify SAP credentials by fetching the OData service document.
 * Throws typed errors: "SAP_UNAUTHORIZED" | "SAP_NETWORK_ERROR".
 */
async function verifySapCredentials(sapUser, sapPass) {
  const url = `${SAP_BASE_URL}${SAP_ODATA_PATH}/?sap-client=${encodeURIComponent(SAP_CLIENT)}&$format=json`;
  let res;
  try {
    res = await undiciFetch(url, {
      headers:    { Authorization: basicAuth(sapUser, sapPass), Accept: 'application/json' },
      dispatcher: sapAgent,
    });
  } catch {
    throw new Error('SAP_NETWORK_ERROR');
  }
  if (res.status === 401 || res.status === 403) throw new Error('SAP_UNAUTHORIZED');
  if (!res.ok) throw new Error('SAP_NETWORK_ERROR');
}

/**
 * Fetch asset details from the SAP OData service.
 * Uses compound-key entity: AssetDetailSet(IvAssetNumber='...',IvCompanyCode='...')
 * Asset number is zero-padded to 12 digits (SAP internal format).
 * Throws on error.
 */
async function fetchAssetFromSAP(assetNo, companyCode, sapUser, sapPass) {
  // SAP internal format: 12-digit zero-padded asset number
  const paddedAsset = String(assetNo).padStart(12, '0');

  const url =
    `${SAP_BASE_URL}${SAP_ODATA_PATH}/AssetDetailSet` +
    `(IvAssetNumber='${encodeURIComponent(paddedAsset)}',IvCompanyCode='${encodeURIComponent(companyCode)}')` +
    `?sap-client=${encodeURIComponent(SAP_CLIENT)}&$format=json`;

  let res;
  try {
    res = await undiciFetch(url, {
      headers:    { Authorization: basicAuth(sapUser, sapPass), Accept: 'application/json' },
      dispatcher: sapAgent,
    });
  } catch {
    throw new Error('SAP_NETWORK_ERROR');
  }

  if (res.status === 401 || res.status === 403) throw new Error('SAP_UNAUTHORIZED');
  if (res.status === 404) throw new Error('SAP_NOT_FOUND');
  if (!res.ok) throw new Error('SAP_NETWORK_ERROR');

  const data  = await res.json();
  const asset = data?.d;
  if (!asset) throw new Error('SAP_NOT_FOUND');

  return {
    plant:            asset.EvPlant          || '',
    department:       asset.EvDepartment     || '',
    assetDescription: asset.EvAssetDesc      || '',
    totalQuantity:    asset.EvTotalQuantity  || '',
    yearOfPurchase:   asset.EvYearOfPurchase || '',
    cost:             asset.EvAcquisitionValue != null ? String(asset.EvAcquisitionValue) : '',
    bookValue:        asset.EvBookValue        != null ? String(asset.EvBookValue)        : '',
  };
}

module.exports = { verifySapCredentials, fetchAssetFromSAP };