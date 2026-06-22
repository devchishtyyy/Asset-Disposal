# BTP Integration Suite API Mapping Guide

## Overview
The Asset Disposal application has been refactored to route all external API calls (SAP, SuccessFactors) through a centralized **BTP Integration Suite proxy** instead of calling these services directly.

### New Architecture
```
Frontend (Port 5173)
    ↓
Frontend Server (Port 6001)
    ↓
Backend Express App (Port 3001)
    ├─ Routes remain unchanged: /api/auth, /api/sap, /api/workflows, etc.
    ├─ Service layer now routes through BTP Proxy
    └─ BTP Integration Suite Proxy
        ├─ https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values
        ├─ Handles SAP OData calls
        ├─ Handles SuccessFactors authentication
        └─ Returns normalized responses
```

---

## Configuration

### 1. Environment Variables

Update `backend/.env`:

```env
# BTP Integration Suite Proxy Configuration
BTP_PROXY_URL=https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values
BTP_API_KEY=your_api_key_here  # If authentication is required
```

### 2. Modified Files

| File | Change | Purpose |
|------|--------|---------|
| `backend/services/btpProxy.js` | **NEW** | Central proxy wrapper for all BTP calls |
| `backend/services/sapProxy.js` | **Updated** | Now delegates to btpProxy.js |
| `backend/services/sfProxy.js` | **Updated** | Now delegates to btpProxy.js |
| `backend/routes/sap.js` | No change | Still calls sapProxy functions |
| `backend/routes/auth.js` | No change | Still calls sfProxy functions |

---

## API Endpoint Mapping

### SAP Verification

**Before (Direct SAP Call):**
```
Client: POST /api/sap/verify
    ↓
Backend: Direct OData call to SAP
    URL: https://vhpctds4ci.sap.packagesgroup.com:44300/sap/opu/odata/sap/ZASSET_WRITEOFF_SRV_SRV/
    Headers: Basic Auth with sapUser:sapPass
```

**After (Via BTP):**
```
Client: POST /api/sap/verify { sapUser, sapPass }
    ↓
Backend: Call BTP Proxy
    URL: https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=sap/verify
    Method: POST
    Body: { sapUser, sapPass }
    Headers: Bearer {BTP_API_KEY} (if configured)
    ↓
    Response: { ok: true }
```

---

### SAP Asset Lookup

**Before (Direct SAP Call):**
```
Client: POST /api/sap/asset { assetNo, companyCode, sapUser, sapPass }
    ↓
Backend: Direct OData compound-key call to SAP
    URL: https://vhpctds4ci.sap.packagesgroup.com:44300/sap/opu/odata/.../
          AssetDetailSet(IvAssetNumber='000000000123',IvCompanyCode='0100')
    Headers: Basic Auth
    Response: SAP OData format with fields: EvPlant, EvDepartment, etc.
```

**After (Via BTP):**
```
Client: POST /api/sap/asset { assetNo, companyCode, sapUser, sapPass }
    ↓
Backend: Call BTP Proxy
    URL: https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=sap/asset
    Method: POST
    Body: {
      assetNo: "123",
      companyCode: "0100",
      sapUser: "user123",
      sapPass: "password"
    }
    Headers: Bearer {BTP_API_KEY}
    ↓
    Response: {
      ok: true,
      data: {
        plant: "1000",
        department: "MAR",
        assetDescription: "Equipment Item",
        totalQuantity: 5,
        yearOfPurchase: 2018,
        cost: "50000",
        bookValue: "25000"
      }
    }
```

---

### SuccessFactors Login

**Before (Direct SF Call):**
```
Client: POST /api/auth/login { userId, password }
    ↓
Backend: Direct OData call to SuccessFactors
    URL: https://api44.sapsf.com/odata/v2/Background_Community?$top=1
    Headers: Basic Auth with userId@packagesli:password
    Then: Fetch employee details from /odata/v2/EmpJob
    Response: User profile with jobTitle, department, businessUnit
```

**After (Via BTP):**
```
Client: POST /api/auth/login { userId, password }
    ↓
Backend: Call BTP Proxy
    URL: https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=auth/login
    Method: POST
    Body: {
      userId: "10009471",
      password: "password123"
    }
    Headers: Bearer {BTP_API_KEY}
    ↓
    Response: {
      ok: true,
      data: {
        userId: "10009471",
        name: "Employee Name",
        sfAuthenticated: true,
        jobTitle: "Manager",
        department: "Sales",
        businessUnit: "BU001",
        company: "Packages Group"
      }
    }
```

---

## BTP Integration Suite - Expected Endpoint Specification

The BTP proxy should implement the following actions:

### Action: `sap/verify`
**Purpose:** Verify SAP credentials  
**Request:**
```json
{
  "sapUser": "string",
  "sapPass": "string"
}
```
**Response (Success):**
```json
{
  "ok": true
}
```
**Response (Error):**
```json
{
  "ok": false,
  "error": "UNAUTHORIZED" | "NETWORK_ERROR"
}
```

---

### Action: `sap/asset`
**Purpose:** Lookup asset details from SAP  
**Request:**
```json
{
  "assetNo": "123",
  "companyCode": "0100",
  "sapUser": "string",
  "sapPass": "string"
}
```
**Response (Success):**
```json
{
  "ok": true,
  "data": {
    "plant": "1000",
    "department": "MAR",
    "assetDescription": "Equipment Item",
    "totalQuantity": "5",
    "yearOfPurchase": "2018",
    "cost": "50000",
    "bookValue": "25000"
  }
}
```
**Response (Not Found):**
```json
{
  "ok": false,
  "error": "NOT_FOUND"
}
```
**Response (Unauthorized):**
```json
{
  "ok": false,
  "error": "UNAUTHORIZED"
}
```

---

### Action: `auth/login`
**Purpose:** Authenticate user via SuccessFactors  
**Request:**
```json
{
  "userId": "10009471",
  "password": "password123"
}
```
**Response (Success):**
```json
{
  "ok": true,
  "data": {
    "userId": "10009471",
    "name": "Employee Name",
    "sfAuthenticated": true,
    "jobTitle": "Manager",
    "department": "Sales",
    "businessUnit": "BU001",
    "company": "Packages Group"
  }
}
```
**Response (Error):**
```json
{
  "ok": false,
  "error": "UNAUTHORIZED" | "NETWORK_ERROR"
}
```

---

## Migration Steps

### Step 1: Deploy New Code
Push the refactored code to your repository:
- ✅ New `backend/services/btpProxy.js`
- ✅ Updated `backend/services/sapProxy.js` (now a wrapper)
- ✅ Updated `backend/services/sfProxy.js` (now a wrapper)
- ✅ Updated `backend/.env` and `.env.example`

### Step 2: Update BTP Configuration
```bash
# In backend/.env
BTP_PROXY_URL=https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values
BTP_API_KEY=your_api_key  # If required by BTP endpoints
```

### Step 3: Restart Backend Server
```bash
npm run start:backend
# or
node backend/server.js
```

### Step 4: Test Integration
- Test SAP credential verification: `POST /api/sap/verify`
- Test SAP asset lookup: `POST /api/sap/asset`
- Test login: `POST /api/auth/login`

---

## Error Handling

### Mapped Error Types

| BTP Error | Backend Response | HTTP Status |
|-----------|------------------|-------------|
| `UNAUTHORIZED` | `{ error: "SAP_UNAUTHORIZED" }` or auth error message | 401 |
| `NOT_FOUND` | `{ error: "SAP_NOT_FOUND" }` | 404 |
| `NETWORK_ERROR` | `{ error: "SAP_NETWORK_ERROR" }` | 502 |
| BTP unavailable | `{ error: "SAP_NETWORK_ERROR" }` | 502 |
| Invalid API Key | Handled by BTP (returns 401/403) | 401/403 |

### Client-Side Error Messages

These remain unchanged from the user's perspective:
- "Invalid credentials" → 401 from BTP UNAUTHORIZED
- "Asset not found" → 404 from BTP NOT_FOUND
- "Service unavailable" → 502 from BTP network errors

---

## Fallback & Testing

### Testing Without BTP
To test locally without BTP:

1. Set `SAP_MOCK=true` in backend/.env (legacy fallback)
2. Routes will return mock data instead of calling BTP
3. Remove once BTP is ready

### Legacy Direct Calls (Rollback)
To rollback to direct SAP/SF calls:

1. Restore old `sapProxy.js` and `sfProxy.js` files from git
2. Update `backend/.env` with legacy SAP/SF URLs
3. Restart backend

---

## File Structure

```
backend/
├── services/
│   ├── btpProxy.js          ✨ NEW: Central BTP proxy wrapper
│   ├── sapProxy.js          📝 UPDATED: Now delegates to btpProxy
│   ├── sfProxy.js           📝 UPDATED: Now delegates to btpProxy
│   ├── email.js             ➖ Unchanged: Direct email via SMTP
│   └── ...
├── routes/
│   ├── auth.js              ➖ Unchanged: Uses sfProxy
│   ├── sap.js               ➖ Unchanged: Uses sapProxy
│   ├── workflows.js         ➖ Unchanged: Workflow management
│   └── ...
├── .env                     📝 UPDATED: Added BTP config
├── .env.example             📝 UPDATED: Documented BTP config
└── server.js                ➖ Unchanged: Express setup
```

---

## Monitoring & Debugging

### Enable Debug Logging
Add to `backend/services/btpProxy.js`:
```javascript
// Uncomment for debugging
// console.log('[BTP Proxy]', action, payload);
// console.log('[BTP Response]', response);
```

### Check BTP Connectivity
```bash
curl -X POST "https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=sap/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"sapUser":"test","sapPass":"test"}'
```

---

## Frequently Asked Questions

**Q: Do the frontend API endpoints change?**  
A: No. `/api/auth/login`, `/api/sap/verify`, `/api/sap/asset` remain exactly the same.

**Q: Do I need to update frontend code?**  
A: No. Frontend communicates with the backend the same way as before.

**Q: Can I still use SAP_MOCK for testing?**  
A: Yes, but SAP_MOCK support is deprecated. Use BTP endpoints for testing instead.

**Q: What if BTP is down?**  
A: The backend will return 502/503 errors, same as before.

**Q: How do I test locally without internet?**  
A: Mock BTP by creating a local proxy server or use SAP_MOCK=true temporarily.
