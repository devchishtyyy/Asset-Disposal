'use strict';

/**
 * SuccessFactors proxy wrapper.
 * Now routes all authentication calls through BTP Integration Suite.
 * This provides a clean abstraction for SuccessFactors operations while centralizing
 * the Integration Suite integration point.
 */

const { loginWithSF } = require('./btpProxy');

module.exports = { loginWithSF };