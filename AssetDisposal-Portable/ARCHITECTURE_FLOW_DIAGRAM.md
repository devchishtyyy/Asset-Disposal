# API Call Flow - Before & After Migration to BTP

## BEFORE: Direct API Calls (Legacy)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React) - localhost:5173                                          │
│ ├─ Login Form → POST /api/auth/login { userId, password }                 │
│ ├─ SAP Verify → POST /api/sap/verify { sapUser, sapPass }                │
│ └─ Asset Lookup → POST /api/sap/asset { assetNo, companyCode, ... }      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓ HTTP Proxy
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND SERVER - localhost:6001                                           │
│ (Proxies /api requests to backend)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓ 
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND (Express) - localhost:3001                                         │
│ ├─ POST /api/auth/login                                                   │
│ │   └─ Call: services/sfProxy.js → loginWithSF()                          │
│ │       └─ Direct HTTPS call to: https://api44.sapsf.com/odata/v2/...     │
│ │                                                                           │
│ ├─ POST /api/sap/verify                                                   │
│ │   └─ Call: services/sapProxy.js → verifySapCredentials()                │
│ │       └─ Direct HTTPS call to:                                          │
│ │          https://vhpctds4ci.sap.packagesgroup.com:44300/...             │
│ │                                                                           │
│ └─ POST /api/sap/asset                                                    │
│     └─ Call: services/sapProxy.js → fetchAssetFromSAP()                   │
│         └─ Direct HTTPS call to:                                          │
│            https://vhpctds4ci.sap.packagesgroup.com:44300/...             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓↓↓ DIRECT CONNECTIONS ↓↓↓
        ┌──────────────────┬──────────────────────┬──────────────────┐
        ↓                  ↓                      ↓                  ↓
    ┌────────────┐    ┌─────────────────┐    ┌──────────┐     ┌──────────┐
    │ SAP ERP    │    │ SuccessFactors  │    │ SMTP     │     │ Database │
    │ S4HANA     │    │ (OData API)     │    │ (Email)  │     │ (Local)  │
    └────────────┘    └─────────────────┘    └──────────┘     └──────────┘
```

---

## AFTER: Via BTP Integration Suite (New)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React) - localhost:5173                                          │
│ ├─ Login Form → POST /api/auth/login { userId, password }                 │
│ ├─ SAP Verify → POST /api/sap/verify { sapUser, sapPass }                │
│ └─ Asset Lookup → POST /api/sap/asset { assetNo, companyCode, ... }      │
│                                                                             │
│ ⚠️ NO CHANGE - Frontend API calls remain identical!                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓ HTTP Proxy
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND SERVER - localhost:6001                                           │
│ (Proxies /api requests to backend)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓ 
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND (Express) - localhost:3001                                         │
│ ├─ POST /api/auth/login                                                   │
│ │   └─ Call: services/sfProxy.js → loginWithSF()                          │
│ │       └─ Call: services/btpProxy.js → callBtpProxy('auth/login', {...}) │
│ │           └─ HTTPS POST to BTP Proxy (see below)                        │
│ │                                                                           │
│ ├─ POST /api/sap/verify                                                   │
│ │   └─ Call: services/sapProxy.js → verifySapCredentials()                │
│ │       └─ Call: services/btpProxy.js → callBtpProxy('sap/verify', {...}) │
│ │           └─ HTTPS POST to BTP Proxy (see below)                        │
│ │                                                                           │
│ └─ POST /api/sap/asset                                                    │
│     └─ Call: services/sapProxy.js → fetchAssetFromSAP()                   │
│         └─ Call: services/btpProxy.js → callBtpProxy('sap/asset', {...})  │
│             └─ HTTPS POST to BTP Proxy (see below)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ BTP INTEGRATION SUITE PROXY                                                │
│ https://devspace.test.apimanagement.eu10.hana.ondemand.com/asset/values   │
│                                                                             │
│ POST ?action=sap/verify                                                   │
│ POST ?action=sap/asset                                                    │
│ POST ?action=auth/login                                                   │
│                                                                             │
│ ✨ Single entry point for all external API calls                          │
│ ✨ Handles credential passing (SAP user/pass, SF user/pass)               │
│ ✨ Routes to appropriate backend system                                   │
│ ✨ Returns normalized responses                                           │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
        ┌──────────────────┬──────────────────────────────────────┐
        ↓                  ↓                                      ↓
    ┌────────────┐    ┌─────────────────┐                  ┌──────────────┐
    │ SAP ERP    │    │ SuccessFactors  │                  │ Local SMTP   │
    │ S4HANA     │    │ (OData API)     │                  │ (Email Only) │
    │            │    │                 │                  │              │
    │ ← Proxied  │    │ ← Proxied       │                  │ ← Direct     │
    │   by BTP   │    │   by BTP        │                  │   (Unchanged)│
    └────────────┘    └─────────────────┘                  └──────────────┘
```

---

## Request/Response Transformation

### Authentication Flow

```
Step 1: User Login
┌──────────────────────────────────────────────────────────────────────────┐
│ CLIENT REQUEST                                                           │
│ POST /api/auth/login                                                    │
│ Body: { userId: "10009471", password: "mypassword" }                   │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BACKEND LAYER 1: routes/auth.js                                         │
│ ├─ Receives request                                                     │
│ ├─ Checks if DEV account (direct return) OR calls loginWithSF()         │
│ └─ Passes to services/sfProxy.js                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BACKEND LAYER 2: services/sfProxy.js (Wrapper)                          │
│ ├─ Calls: loginWithSF(userId, password)                                │
│ └─ Delegates to: services/btpProxy.js                                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BACKEND LAYER 3: services/btpProxy.js (Core Proxy)                     │
│ ├─ Calls: callBtpProxy('auth/login', { userId, password })            │
│ ├─ URL: https://devspace.test.apimanagement.eu10.hana.ondemand.com/   │
│ │        asset/values?action=auth/login                               │
│ └─ Body: { userId: "10009471", password: "mypassword" }               │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BTP INTEGRATION SUITE                                                   │
│ ├─ Receives: POST ?action=auth/login                                  │
│ │           Body: { userId, password }                               │
│ ├─ Internally:                                                        │
│ │  └─ Calls SuccessFactors OData with userId@packagesli:password    │
│ └─ Returns: { ok: true, data: { userId, name, jobTitle, ... } }    │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BTP RESPONSE TRANSFORMATION                                             │
│ BTP returns:                                                             │
│ {                                                                        │
│   ok: true,                                                             │
│   data: {                                                               │
│     userId: "10009471",                                                │
│     name: "Employee Name",                                             │
│     sfAuthenticated: true,                                             │
│     jobTitle: "Manager",                                               │
│     department: "Sales",                                               │
│     businessUnit: "BU001",                                             │
│     company: "Packages Group"                                          │
│   }                                                                     │
│ }                                                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BACKEND PROCESSING (routes/auth.js)                                    │
│ ├─ Extract user data from response                                     │
│ ├─ Create JWT payload:                                                 │
│ │  {                                                                   │
│ │    empNo: "10009471",                                               │
│ │    name: "Employee Name",                                           │
│ │    sfAuthenticated: true,                                           │
│ │    jobTitle: "Manager",                                             │
│ │    department: "Sales",                                             │
│ │    businessUnit: "BU001"                                            │
│ │  }                                                                   │
│ ├─ Sign JWT with JWT_SECRET                                           │
│ └─ Return response                                                     │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ CLIENT RESPONSE                                                         │
│ HTTP 200 OK                                                             │
│ {                                                                       │
│   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",                   │
│   user: {                                                               │
│     empNo: "10009471",                                                 │
│     name: "Employee Name",                                             │
│     sfAuthenticated: true,                                             │
│     jobTitle: "Manager",                                               │
│     department: "Sales",                                               │
│     businessUnit: "BU001",                                             │
│     username: "10009471"                                               │
│   }                                                                     │
│ }                                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## SAP Asset Lookup Flow

```
Step 2: SAP Asset Verification
┌──────────────────────────────────────────────────────────────────────────┐
│ CLIENT REQUEST                                                           │
│ POST /api/sap/verify                                                    │
│ Body: { sapUser: "ZUSER001", sapPass: "sappassword" }                  │
│ Header: Authorization: Bearer {jwt_token}                              │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓ (Auth middleware checks JWT) ✓

┌──────────────────────────────────────────────────────────────────────────┐
│ BACKEND → BTP PROXY                                                     │
│ POST https://devspace.test.apimanagement.eu10.hana.ondemand.com/      │
│     asset/values?action=sap/verify                                     │
│ Headers:                                                                 │
│   Content-Type: application/json                                        │
│   Authorization: Bearer {BTP_API_KEY}                                   │
│ Body: {                                                                  │
│   sapUser: "ZUSER001",                                                 │
│   sapPass: "sappassword"                                               │
│ }                                                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BTP INTEGRATION SUITE                                                   │
│ ├─ Validates SAP credentials using SAP OData                           │
│ └─ Returns: { ok: true }  (or { ok: false, error: "UNAUTHORIZED" })   │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ CLIENT RESPONSE                                                         │
│ HTTP 200 OK                                                             │
│ { ok: true }                                                             │
└──────────────────────────────────────────────────────────────────────────┘


Step 3: SAP Asset Lookup
┌──────────────────────────────────────────────────────────────────────────┐
│ CLIENT REQUEST                                                           │
│ POST /api/sap/asset                                                    │
│ Body: {                                                                  │
│   assetNo: "123456",                                                   │
│   companyCode: "0100",                                                 │
│   sapUser: "ZUSER001",                                                 │
│   sapPass: "sappassword"                                               │
│ }                                                                        │
│ Header: Authorization: Bearer {jwt_token}                              │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BACKEND → BTP PROXY                                                     │
│ POST https://devspace.test.apimanagement.eu10.hana.ondemand.com/      │
│     asset/values?action=sap/asset                                      │
│ Body: {                                                                  │
│   assetNo: "123456",                                                   │
│   companyCode: "0100",                                                 │
│   sapUser: "ZUSER001",                                                 │
│   sapPass: "sappassword"                                               │
│ }                                                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BTP INTEGRATION SUITE                                                   │
│ ├─ Pads assetNo: "123456" → "000000123456"                             │
│ ├─ Builds SAP OData compound-key URL                                   │
│ ├─ Calls SAP with Basic Auth                                           │
│ └─ Transforms SAP fields:                                              │
│    ├─ EvPlant → plant                                                 │
│    ├─ EvDepartment → department                                       │
│    ├─ EvAssetDesc → assetDescription                                  │
│    ├─ EvTotalQuantity → totalQuantity                                 │
│    ├─ EvYearOfPurchase → yearOfPurchase                               │
│    ├─ EvAcquisitionValue → cost                                       │
│    └─ EvBookValue → bookValue                                         │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ BTP RESPONSE                                                             │
│ {                                                                       │
│   ok: true,                                                             │
│   data: {                                                               │
│     plant: "PLANT001",                                                 │
│     department: "MARKETING",                                           │
│     assetDescription: "Laptop Computer",                               │
│     totalQuantity: "1",                                                │
│     yearOfPurchase: "2020",                                            │
│     cost: "2000000",                                                   │
│     bookValue: "1200000"                                               │
│   }                                                                     │
│ }                                                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓

┌──────────────────────────────────────────────────────────────────────────┐
│ CLIENT RESPONSE                                                         │
│ HTTP 200 OK                                                             │
│ {                                                                       │
│   plant: "PLANT001",                                                   │
│   department: "MARKETING",                                             │
│   assetDescription: "Laptop Computer",                                 │
│   totalQuantity: "1",                                                  │
│   yearOfPurchase: "2020",                                              │
│   cost: "2000000",                                                     │
│   bookValue: "1200000"                                                 │
│ }                                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Key Changes Summary

| Aspect | Before (Direct) | After (BTP Proxy) | Impact |
|--------|-----------------|-------------------|--------|
| **Auth Method** | Direct Basic Auth to SF | JWT bearer to BTP | More secure, centralized |
| **SAP Calls** | Direct OData to S4HANA | Routed through BTP | Compliance, centralized control |
| **Credentials** | Per-request in direct calls | BTP handles, app passes | Better security posture |
| **Error Handling** | Direct SAP errors | Normalized BTP errors | Simpler error handling |
| **Field Mapping** | Backend transforms SAP fields | BTP transforms or backend | Flexible, cleaner separation |
| **Network Path** | App → SAP/SF directly | App → BTP → SAP/SF | Single pane of glass |

---

## Configuration Checklist

- [ ] Set `BTP_PROXY_URL` in backend/.env
- [ ] Set `BTP_API_KEY` if BTP requires authentication
- [ ] Restart backend server
- [ ] Test: POST /api/auth/login
- [ ] Test: POST /api/sap/verify
- [ ] Test: POST /api/sap/asset
- [ ] Monitor logs for errors
- [ ] Update deployment documentation
- [ ] Brief team on new architecture
