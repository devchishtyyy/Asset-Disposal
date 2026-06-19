'use strict';

const { Agent, fetch: undiciFetch } = require('undici');

const SF_COMPANY_ID = process.env.SF_COMPANY_ID || 'packagesli';
const SF_BASE_URL = process.env.SF_BASE_URL || 'https://api44.sapsf.com';

const sfAgent = new Agent({ connect: { rejectUnauthorized: false } });

function basicAuth(user, pass) {
  return 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
}

async function loginWithSF(userId, password) {
  const sfUsername = userId + '@' + SF_COMPANY_ID;
  const authHeader = basicAuth(sfUsername, password);
  let validationRes;
  try {
    validationRes = await undiciFetch(
      SF_BASE_URL + '/odata/v2/Background_Community?$top=1&$format=json',
      { headers: { Authorization: authHeader, Accept: 'application/json' }, dispatcher: sfAgent }
    );
  } catch (err) {
    console.error('[SF] Network error:', err.message);
    throw new Error('Unable to reach SuccessFactors. Check your network and try again.');
  }
  if (validationRes.status === 401 || validationRes.status === 403)
    throw new Error('Invalid SuccessFactors credentials. Please try again.');
  if (!validationRes.ok)
    throw new Error('Authentication failed (HTTP ' + validationRes.status + '). Please try again.');
  let userInfo = { username: userId, sfAuthenticated: true };
  try {
    const empRes = await undiciFetch(
      SF_BASE_URL + '/odata/v2/EmpJob?$filter=userId eq ' + encodeURIComponent(' + userId + ') +
        '&$select=userId,jobTitle,department,businessUnit,company&$top=1&$format=json',
      { headers: { Authorization: authHeader, Accept: 'application/json' }, dispatcher: sfAgent }
    );
    if (empRes.ok) {
      const empData = await empRes.json();
      const emp = empData && empData.d && empData.d.results && empData.d.results[0];
      if (emp) userInfo = Object.assign({}, userInfo, {
        jobTitle: emp.jobTitle || '',
        department: emp.department || '',
        businessUnit: emp.businessUnit || '',
        company: emp.company || '',
      });
    }
  } catch (_) {}
  return userInfo;
}

module.exports = { loginWithSF };