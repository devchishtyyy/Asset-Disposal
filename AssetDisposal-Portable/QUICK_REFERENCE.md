# Quick Reference: BTP Integration Suite Proxy

## TL;DR

**All SAP and SuccessFactors API calls now go through BTP Integration Suite.**

```
https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values
```

---

## Environment Setup

```bash
# backend/.env
BTP_PROXY_URL=https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values
BTP_API_KEY=your_api_key_here
```

---

## API Actions

### 1. Verify SAP Credentials

**Request:**
```
POST https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=sap/verify
Content-Type: application/json
Authorization: Bearer {BTP_API_KEY}

{
  "sapUser": "ZUSER001",
  "sapPass": "password"
}
```

**Response (Success):**
```json
{ "ok": true }
```

**Response (Error):**
```json
{ "ok": false, "error": "UNAUTHORIZED" }
```

---

### 2. Lookup SAP Asset

**Request:**
```
POST https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=sap/asset
Content-Type: application/json
Authorization: Bearer {BTP_API_KEY}

{
  "assetNo": "123456",
  "companyCode": "0100",
  "sapUser": "ZUSER001",
  "sapPass": "password"
}
```

**Response (Success):**
```json
{
  "ok": true,
  "data": {
    "plant": "PLANT001",
    "department": "MARKETING",
    "assetDescription": "Laptop Computer",
    "totalQuantity": "1",
    "yearOfPurchase": "2020",
    "cost": "2000000",
    "bookValue": "1200000"
  }
}
```

**Response (Not Found):**
```json
{ "ok": false, "error": "NOT_FOUND" }
```

---

### 3. SuccessFactors Authentication

**Request:**
```
POST https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values?action=auth/login
Content-Type: application/json
Authorization: Bearer {BTP_API_KEY}

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
    "name": "John Doe",
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
{ "ok": false, "error": "UNAUTHORIZED" }
```

---

## Frontend API (No Changes!)

### Login
```javascript
POST /api/auth/login
{ "userId": "10009471", "password": "password123" }
// Returns: { "token": "...", "user": {...} }
```

### Verify SAP Credentials
```javascript
POST /api/sap/verify
{ "sapUser": "ZUSER001", "sapPass": "password" }
// Returns: { "ok": true }
```

### Lookup Asset from SAP
```javascript
POST /api/sap/asset
{ "assetNo": "123456", "companyCode": "0100", "sapUser": "ZUSER001", "sapPass": "password" }
// Returns: { "plant": "...", "department": "...", ... }
```

---

## Code Flow

### Authentication
```
Frontend Login Request
    ↓
routes/auth.js
    ↓
services/sfProxy.js → loginWithSF()
    ↓
services/btpProxy.js → callBtpProxy('auth/login', {...})
    ↓
BTP Integration Suite (via HTTP POST)
    ↓
Response → Create JWT → Return to Frontend
```

### SAP Asset Lookup
```
Frontend Asset Lookup Request
    ↓
routes/sap.js
    ↓
services/sapProxy.js → fetchAssetFromSAP()
    ↓
services/btpProxy.js → callBtpProxy('sap/asset', {...})
    ↓
BTP Integration Suite (via HTTP POST)
    ↓
Response → Transform Fields → Return to Frontend
```

---

## Error Responses

| HTTP Status | BTP Error | Meaning | Recovery |
|-------------|-----------|---------|----------|
| 401 | UNAUTHORIZED | Invalid credentials | Check SAP/SF user/password |
| 404 | NOT_FOUND | Asset doesn't exist in SAP | Verify asset number and company code |
| 502 | NETWORK_ERROR | BTP or backend unavailable | Check BTP_PROXY_URL, network connectivity |
| 500 | Internal Error | Backend processing error | Check server logs |

---

## Troubleshooting

### BTP Returns 401 Unauthorized
- Check `BTP_API_KEY` is set correctly
- Verify Bearer token is being passed in Authorization header
- Contact BTP admin for API key verification

### Asset Not Found (404)
- Verify asset number format (should be numeric)
- Verify company code matches SAP company code
- Verify SAP credentials are correct

### Connection Timeout (502)
- Check `BTP_PROXY_URL` is correct and accessible
- Check network connectivity to BTP endpoint
- Check firewall rules if on corporate network

### JWT Token Issues
- Token created by Backend, not BTP
- JWT_SECRET must be set in backend/.env
- Token expires in 8 hours by default

---

## Configuration Files

### backend/.env
```bash
# REQUIRED
BTP_PROXY_URL=https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values

# OPTIONAL (if BTP requires authentication)
BTP_API_KEY=

# Standard Backend Config
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=8h
PORT=3001
NODE_ENV=production
```

### backend/services/btpProxy.js
```javascript
// Main proxy implementation
// Handles: callBtpProxy(), verifySapCredentials(), fetchAssetFromSAP(), loginWithSF()

// Called by: sapProxy.js and sfProxy.js
```

---

## Testing Commands

### Test Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"T001","password":"test123"}'
```

### Test SAP Verify (after getting token)
```bash
curl -X POST http://localhost:3001/api/sap/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"sapUser":"TESTUSER","sapPass":"testpass"}'
```

### Test Asset Lookup (after getting token)
```bash
curl -X POST http://localhost:3001/api/sap/asset \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"assetNo":"123","companyCode":"0100","sapUser":"TESTUSER","sapPass":"testpass"}'
```

---

## Key Points

✅ **No Frontend Changes** - All API contracts remain the same  
✅ **Centralized Integration** - Single endpoint for all external calls  
✅ **Better Security** - Credentials never exposed to frontend  
✅ **Easier Maintenance** - All integration logic in one place  
✅ **Error Mapping** - Consistent error handling  

---

## Documentation References

- **Full Guide**: See `BTP_INTEGRATION_GUIDE.md`
- **Architecture Diagrams**: See `ARCHITECTURE_FLOW_DIAGRAM.md`
- **Quick Ref**: This file
