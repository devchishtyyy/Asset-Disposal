# BTP Integration Suite - Request/Response Examples & Debugging

## API Endpoint

```
Method: POST
URL: https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values
Query Parameter: ?action={action_name}
Content-Type: application/json
```

---

## Action: `sap/verify` - Verify SAP Credentials

### Request Example

```http
POST /asset/values?action=sap/verify HTTP/1.1
Host: devspace.test.apimanagement.eu10.hana.ondemand.com
Authorization: Bearer your_api_key_here
Content-Type: application/json

{
  "sapUser": "ZUSER001",
  "sapPass": "MyPassword123"
}
```

### Expected Response (Success - 200)

```json
{
  "ok": true
}
```

### Expected Response (Failure - Unauthorized)

```json
{
  "ok": false,
  "error": "UNAUTHORIZED"
}
```

### What BTP Should Do Internally

1. Extract `sapUser` and `sapPass` from request body
2. Construct SAP OData endpoint URL
3. Call SAP OData service document endpoint with Basic Auth
4. If successful → Return `{ ok: true }`
5. If 401/403 → Return `{ ok: false, error: "UNAUTHORIZED" }`
6. If other error → Return `{ ok: false, error: "NETWORK_ERROR" }`

### Backend Flow After This Request

```
BTP Response { ok: true }
    ↓
btpProxy.js → returns as-is to sapProxy.js
    ↓
routes/sap.js → Returns HTTP 200 { ok: true } to frontend
```

---

## Action: `sap/asset` - Lookup Asset Details from SAP

### Request Example

```http
POST /asset/values?action=sap/asset HTTP/1.1
Host: devspace.test.apimanagement.eu10.hana.ondemand.com
Authorization: Bearer your_api_key_here
Content-Type: application/json

{
  "assetNo": "123456",
  "companyCode": "0100",
  "sapUser": "ZUSER001",
  "sapPass": "MyPassword123"
}
```

### Expected Response (Success - 200)

```json
{
  "ok": true,
  "data": {
    "plant": "PLANT001",
    "department": "MARKETING",
    "assetDescription": "Laptop Computer - Dell XPS",
    "totalQuantity": "1",
    "yearOfPurchase": "2020",
    "cost": "2000000",
    "bookValue": "1200000"
  }
}
```

### Expected Response (Not Found - 404)

```json
{
  "ok": false,
  "error": "NOT_FOUND"
}
```

### Expected Response (Unauthorized - 401)

```json
{
  "ok": false,
  "error": "UNAUTHORIZED"
}
```

### What BTP Should Do Internally

1. Extract parameters: `assetNo`, `companyCode`, `sapUser`, `sapPass`
2. **Format asset number**: Pad to 12 digits with leading zeros
   - Input: `"123456"` → Output: `"000000123456"`
3. **Build SAP OData URL**:
   ```
   https://vhpctds4ci.sap.packagesgroup.com:44300/sap/opu/odata/sap/ZASSET_WRITEOFF_SRV_SRV/AssetDetailSet(IvAssetNumber='000000123456',IvCompanyCode='0100')?sap-client=110&$format=json
   ```
4. **Call SAP with Basic Auth**: `Authorization: Basic base64(ZUSER001:MyPassword123)`
5. **Parse SAP response** and map fields:
   | SAP Field | Output Field |
   |-----------|--------------|
   | `EvPlant` | `plant` |
   | `EvDepartment` | `department` |
   | `EvAssetDesc` | `assetDescription` |
   | `EvTotalQuantity` | `totalQuantity` |
   | `EvYearOfPurchase` | `yearOfPurchase` |
   | `EvAcquisitionValue` | `cost` |
   | `EvBookValue` | `bookValue` |
6. **Return formatted response**:
   ```json
   {
     "ok": true,
     "data": {
       "plant": "PLANT001",
       ...
     }
   }
   ```

### Error Scenarios

| SAP HTTP Response | Action | BTP Response |
|-------------------|--------|--------------|
| 200 with data | Return formatted asset | `{ ok: true, data: {...} }` |
| 404 | Asset not found | `{ ok: false, error: "NOT_FOUND" }` |
| 401/403 | Credentials invalid | `{ ok: false, error: "UNAUTHORIZED" }` |
| 500+ | SAP error | `{ ok: false, error: "NETWORK_ERROR" }` |
| Network timeout | Connection failed | `{ ok: false, error: "NETWORK_ERROR" }` |

### Backend Flow After This Request

```
BTP Response { ok: true, data: {...asset fields...} }
    ↓
btpProxy.js → Validates structure, maps any additional fields
    ↓
sapProxy.js → Returns data as-is
    ↓
routes/sap.js → Returns HTTP 200 {asset data} to frontend
```

---

## Action: `auth/login` - SuccessFactors Authentication

### Request Example

```http
POST /asset/values?action=auth/login HTTP/1.1
Host: devspace.test.apimanagement.eu10.hana.ondemand.com
Authorization: Bearer your_api_key_here
Content-Type: application/json

{
  "userId": "10009471",
  "password": "UserPassword123"
}
```

### Expected Response (Success - 200)

```json
{
  "ok": true,
  "data": {
    "userId": "10009471",
    "name": "John Doe",
    "sfAuthenticated": true,
    "jobTitle": "Sales Manager",
    "department": "Sales",
    "businessUnit": "BU001",
    "company": "Packages Group"
  }
}
```

### Expected Response (Invalid Credentials - 401)

```json
{
  "ok": false,
  "error": "UNAUTHORIZED"
}
```

### Expected Response (Service Unavailable - 502)

```json
{
  "ok": false,
  "error": "NETWORK_ERROR"
}
```

### What BTP Should Do Internally

1. Extract `userId` and `password` from request body
2. **Construct SuccessFactors username**: `{userId}@packagesli`
   - Example: `10009471@packagesli`
3. **Validate credentials** by calling SuccessFactors OData endpoint:
   ```
   https://api44.sapsf.com/odata/v2/Background_Community?$top=1&$format=json
   Authorization: Basic base64(10009471@packagesli:UserPassword123)
   ```
4. If validation fails (401/403) → Return `{ ok: false, error: "UNAUTHORIZED" }`
5. **If validation succeeds**, fetch employee details:
   ```
   https://api44.sapsf.com/odata/v2/EmpJob?$filter=userId eq '10009471'&$select=userId,jobTitle,department,businessUnit,company&$top=1&$format=json
   Authorization: Basic base64(10009471@packagesli:UserPassword123)
   ```
6. **Extract and return employee data**:
   ```json
   {
     "ok": true,
     "data": {
       "userId": "10009471",
       "name": "Name from SF or use userId",
       "sfAuthenticated": true,
       "jobTitle": "Employee Job Title",
       "department": "Employee Department",
       "businessUnit": "Employee BU",
       "company": "Employee Company"
     }
   }
   ```

### Error Scenarios

| SuccessFactors Response | Action | BTP Response |
|-------------------------|--------|--------------|
| 200 with employee data | Return formatted user | `{ ok: true, data: {...} }` |
| 401/403 on validation | Credentials invalid | `{ ok: false, error: "UNAUTHORIZED" }` |
| Network timeout | Connection failed | `{ ok: false, error: "NETWORK_ERROR" }` |
| 500 from SF | Service error | `{ ok: false, error: "NETWORK_ERROR" }` |

### Backend Flow After This Request

```
BTP Response { ok: true, data: {userId, name, jobTitle, department, ...} }
    ↓
sfProxy.js → Returns user data
    ↓
routes/auth.js → Creates JWT payload from user data
    ↓
routes/auth.js → Signs JWT with JWT_SECRET
    ↓
Frontend gets HTTP 200 { token, user }
```

---

## Common Test Scenarios

### Test 1: Verify SAP Credentials (Using curl)

```bash
curl -X POST "https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=sap/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "sapUser": "TESTUSER",
    "sapPass": "testpass123"
  }'
```

**Expected**: 
```json
{"ok": true}
```

---

### Test 2: Valid Asset Lookup

```bash
curl -X POST "https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=sap/asset" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "assetNo": "123456",
    "companyCode": "0100",
    "sapUser": "TESTUSER",
    "sapPass": "testpass123"
  }'
```

**Expected**:
```json
{
  "ok": true,
  "data": {
    "plant": "PLANT001",
    "department": "MFG",
    "assetDescription": "Test Asset",
    "totalQuantity": "5",
    "yearOfPurchase": "2019",
    "cost": "150000",
    "bookValue": "75000"
  }
}
```

---

### Test 3: Asset Not Found

```bash
curl -X POST "https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=sap/asset" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "assetNo": "999999999999",
    "companyCode": "0100",
    "sapUser": "TESTUSER",
    "sapPass": "testpass123"
  }'
```

**Expected**:
```json
{"ok": false, "error": "NOT_FOUND"}
```

---

### Test 4: Invalid Credentials

```bash
curl -X POST "https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=auth/login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "userId": "10009471",
    "password": "wrongpassword"
  }'
```

**Expected**:
```json
{"ok": false, "error": "UNAUTHORIZED"}
```

---

## Debugging Checklist

If integration is failing, check these points in order:

### 1. BTP Endpoint Accessibility

```bash
# Test that BTP endpoint is reachable
curl -I https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values

# Should return: HTTP/1.1 405 Method Not Allowed (GET not allowed)
# or HTTP/1.1 401 Unauthorized (if API key required)
# NOT: Connection refused, DNS error, 404 Not Found
```

### 2. Request Format Verification

```bash
# Ensure request has:
# ✓ Correct HTTP method: POST
# ✓ Correct URL with action parameter: ?action=sap/verify
# ✓ Content-Type header: application/json
# ✓ Authorization header: Bearer {API_KEY}
# ✓ Valid JSON body
```

### 3. Response Format Validation

```bash
# BTP Response should always have:
# ✓ "ok" field: true or false (boolean)
# ✓ "error" field (if ok: false): UNAUTHORIZED | NOT_FOUND | NETWORK_ERROR
# ✓ "data" field (if ok: true): Contains action-specific data
```

### 4. Backend Error Logs

Check backend logs for errors like:
```
[BTP Proxy] Network error: ...
[BTP Proxy] HTTP 401 error
[BTP Proxy] JSON parse error: ...
```

### 5. Field Mapping Verification

For `sap/asset` action, verify SAP field mapping:
```
Request fields: assetNo, companyCode, sapUser, sapPass
Response fields: plant, department, assetDescription, totalQuantity, 
                 yearOfPurchase, cost, bookValue
```

---

## Integration Validation

After implementing BTP endpoint, verify:

- [ ] Endpoint accepts POST requests
- [ ] Endpoint requires `?action` query parameter
- [ ] Endpoint validates Bearer token in Authorization header
- [ ] Each action returns correct response format
- [ ] Error handling returns `{ ok: false, error: "..." }`
- [ ] SAP asset number is zero-padded to 12 digits
- [ ] SAP field names are correctly mapped
- [ ] SuccessFactors responses include all required fields
- [ ] All responses are JSON format
- [ ] HTTP status codes are appropriate (200 for success)

---

## Response Format Contract

### Success Response Structure
```json
{
  "ok": true,
  "data": {
    // Action-specific fields
  }
}
```

### Error Response Structure
```json
{
  "ok": false,
  "error": "UNAUTHORIZED|NOT_FOUND|NETWORK_ERROR"
}
```

### Special: sap/asset Success Response
```json
{
  "ok": true,
  "data": {
    "plant": "string",
    "department": "string",
    "assetDescription": "string",
    "totalQuantity": "string",
    "yearOfPurchase": "string",
    "cost": "string (numeric)",
    "bookValue": "string (numeric)"
  }
}
```

### Special: auth/login Success Response
```json
{
  "ok": true,
  "data": {
    "userId": "string",
    "name": "string",
    "sfAuthenticated": boolean,
    "jobTitle": "string",
    "department": "string",
    "businessUnit": "string",
    "company": "string"
  }
}
```

---

## Performance Expectations

- **sap/verify**: < 1 second (simple validation)
- **sap/asset**: < 2 seconds (SAP OData call)
- **auth/login**: < 3 seconds (two SuccessFactors API calls)

If responses exceed these times, check:
- Network latency to SAP/SuccessFactors
- BTP server resources
- SAP/SuccessFactors API performance

---

## Security Notes

- ✅ API Key should be kept secret (use in Authorization header only)
- ✅ SAP/SF credentials are passed in request body, never logged
- ✅ BTP endpoint should enforce HTTPS only
- ✅ Consider rate limiting per API key
- ✅ Log all API calls for audit trail

---

**This document serves as the contract between Backend and BTP Integration Suite implementations.**
