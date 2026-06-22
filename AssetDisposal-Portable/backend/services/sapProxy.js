'use strict';

/**
 * SAP ERP / S4HANA proxy wrapper.
 * Now routes all calls through BTP Integration Suite.
 * This provides a clean abstraction for SAP operations while centralizing
 * the Integration Suite integration point.
 */

const { verifySapCredentials, fetchAssetFromSAP } = require('./btpProxy');

module.exports = { verifySapCredentials, fetchAssetFromSAP };