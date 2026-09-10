# Postman Environment Setup Guide

## Quick Start

### Step 1: Create Environment in Postman

1. Open Postman
2. Click **Environments** in left sidebar
3. Click **Create Environment**
4. Name it: `IMPOC Development`
5. Click **Create**

### Step 2: Add Variables

Add these variables to your environment (copy-paste format):

```
baseUrl = http://localhost:5000
accessToken = (leave empty - auto-filled after login)
refreshToken = (leave empty - auto-filled after login)
testUsername = admin
testPassword = Impoc-Devseed-2026! (DEV-ONLY — see note below)
```

> **DEV-ONLY seed credentials (rotated 2026-09, SEC-L-4):** these are local
> development credentials only. `testPassword` must equal the
> `SEED_ADMIN_PASSWORD` you set when seeding the backend. Never use these
> values (or any committed sample credential) in a production deployment.

### Step 3: Test Login

1. Select your environment from top-right dropdown
2. Go to **Auth** folder → **Login** endpoint
3. Click **Send**
4. ✅ Tokens auto-populate in environment

### Step 4: Populate Role & Permission UUIDs

After successful login:

1. Go to **Roles** folder → **List Roles** endpoint
2. Click **Send**
3. Copy UUID values for each role from response:
   - `adminRoleUuid`
   - `managerRoleUuid`
   - `inventoryManagerRoleUuid`
   - `cashierRoleUuid`
   - `accountantRoleUuid`

4. Go to **Permissions** folder → **List Permissions** endpoint
5. Click **Send**
6. Copy UUID values for permissions

---

## Complete Environment Variables List

### Required for All Tests
```
baseUrl = http://localhost:5000
testUsername = admin
testPassword = Impoc-Devseed-2026!
```

### Auto-Populated After Login
```
accessToken = (auto-filled from login response)
refreshToken = (auto-filled from login response)
```

### Role UUIDs (Get from /api/roles)
```
adminRoleUuid = 
managerRoleUuid = 
inventoryManagerRoleUuid = 
cashierRoleUuid = 
accountantRoleUuid = 
roleUuid = (any role UUID for generic tests)
```

### Permission UUIDs (Get from /api/permissions)
```
permissionUuid = (any permission UUID for testing)
```

### Test Entity UUIDs (Create and Copy)
```
userUuid = (create user, then copy UUID)
testRoleUuid = (copy from List Roles response)
testPermissionUuid = (copy from List Permissions response)
sessionUuid = (get from List Sessions response)
```

### Test Data for Creating New Entities
```
newUsername = testuser
newEmail = testuser@example.com
newPassword = TestPassword123
newFirstName = Test
newLastName = User
newPhone = 9999999999

newRoleName = TEST_ROLE
newRoleDescription = Test role for API testing

newPermissionName = test.permission
newPermissionDescription = Test permission for API testing
```

---

## How to Import from .env File

### Option 1: Postman CLI (Newman)

```bash
npm install -g newman
newman run postman-collection.json -e .env.template
```

### Option 2: Manual Import in Postman

1. **File** → **Import**
2. Select `.env.template`
3. Postman will auto-create environment

### Option 3: Copy-Paste Variables

1. Open `.env.template` file
2. Copy all variable pairs
3. Paste into Postman environment editor

---

## Workflow for Full Testing

### 1. Initial Setup
```bash
# Terminal
cd postman
cp .env.template .env
# Edit .env and add baseUrl only
```

### 2. In Postman
```
1. Create environment "IMPOC Development"
2. Add baseUrl = http://localhost:5000
3. Add testUsername = admin
4. Add testPassword = Impoc-Devseed-2026!
5. Select environment from dropdown
```

### 3. Run Login
```
Auth → Login → Send
✅ accessToken and refreshToken auto-populate
```

### 4. Get Role UUIDs
```
Roles → List Roles → Send
Copy UUID for each role into environment
```

### 5. Get Permission UUIDs
```
Permissions → List Permissions → Send
Copy UUID for at least one permission into environment
```

### 6. Create Test Entities (Optional)
```
Users → Create User → Send
✅ Copy returned UUID to userUuid variable

Roles → Create Role → Send
✅ Copy returned UUID to testRoleUuid variable

Permissions → Create Permission → Send
✅ Copy returned UUID to testPermissionUuid variable
```

### 7. Run Tests
```
Collections → IMPOC API → Run Collection
✅ All tests execute with proper variables
```

---

## Variable Reference Table

| Variable | Type | Source | Required | Example |
|----------|------|--------|----------|---------|
| `baseUrl` | string | Manual | ✅ Yes | `http://localhost:5000` |
| `accessToken` | string | Auto (Login) | ✅ Yes | `eyJhbGc...` |
| `refreshToken` | string | Auto (Login) | ✅ Yes | `eyJhbGc...` |
| `testUsername` | string | Manual | ✅ Yes | `admin` |
| `testPassword` | string | Manual | ✅ Yes | `Impoc-Devseed-2026!` (DEV-ONLY) |
| `adminRoleUuid` | UUID | GET /roles | ✅ Yes | `550e8400-e29b-41d4-a716-446655440000` |
| `permissionUuid` | UUID | GET /permissions | ✅ Yes | `550e8400-e29b-41d4-a716-446655440001` |
| `userUuid` | UUID | POST /users | ⚠️ For CRUD tests | `550e8400-e29b-41d4-a716-446655440002` |
| `newUsername` | string | Manual | ⚠️ For create tests | `testuser` |
| `pageNumber` | integer | Manual | ❌ Optional | `1` |

---

## Troubleshooting

### Variables not resolving?
- ✅ Check environment is selected (top-right dropdown)
- ✅ Verify variable names match exactly (case-sensitive)
- ✅ Ensure variable values are not empty for required ones

### Tokens not auto-populating?
- ✅ Check Login response contains `accessToken` and `refreshToken`
- ✅ Verify test scripts are enabled (Tests tab)
- ✅ Check browser console for errors (Ctrl+Alt+C)

### UUID variables showing as undefined?
- ✅ Populate UUIDs from API responses first
- ✅ Use GET endpoints (List Roles, List Permissions, Get User)
- ✅ Copy exact UUID values from JSON response

### Getting 401 Unauthorized?
- ✅ accessToken might be expired
- ✅ Run Login endpoint again
- ✅ Verify accessToken is in Authorization header

### Getting 403 Forbidden?
- ✅ Current user role doesn't have permission
- ✅ Try with ADMIN role (higher privileges)
- ✅ Check required permissions in endpoint description

---

## Environment Files in Postman

We provide 2 files:

1. **`.env.example`** - Documented with all available variables
2. **`.env.template`** - Ready-to-use template

Both can be imported directly into Postman or used with Newman CLI.

---

## Exporting Your Configured Environment

After setting up variables in Postman:

1. Click **Environments**
2. Right-click **IMPOC Development**
3. Click **Export**
4. Save as `environment.json`
5. Share with team or commit to repo

---

## Using with Newman (CI/CD)

```bash
# Run collection with environment
newman run postman-collection.json -e .env

# Run with multiple environments
newman run postman-collection.json -e .env --globals globals.json

# Generate test report
newman run postman-collection.json -e .env -r html
```

---

## Next: Run Full Test Suite

Once all variables are populated:

1. **Collections** sidebar
2. Right-click **IMPOC API**
3. **Run Collection**
4. Select your environment
5. Click **Run IMPOC API**
6. Watch all 30+ endpoints test automatically ✅
