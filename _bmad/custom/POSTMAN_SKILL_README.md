# BMad Postman Collection Generator Skill

## Overview

This custom BMad skill generates a comprehensive Postman API collection for the IMPOC backend, including:

- ✅ All 34 API endpoints organized by module
- ✅ Authentication flow (login, refresh, logout)
- ✅ Role-based access control test scenarios
- ✅ Request/response examples and templates
- ✅ Automated test scripts for each endpoint
- ✅ Environment variables for multi-environment testing
- ✅ Built-in assertions for status codes and response structure

## Features

### Endpoints Included

**Auth Module** (8 endpoints)
- Login, Refresh, Logout, Logout All
- Get Current User
- List Sessions, Get Session, Revoke Session

**Users Module** (9 endpoints)
- List, Create, Get, Update, Delete Users
- Manage user roles

**Roles Module** (8 endpoints)
- CRUD operations for roles
- Manage role permissions

**Permissions Module** (5 endpoints)
- CRUD operations for permissions

### Role-Based Test Coverage

Includes test scenarios for all 5 roles:
- ADMIN (full access)
- MANAGER
- INVENTORY_MANAGER
- CASHIER
- ACCOUNTANT

### Test Scripts

Each endpoint includes:
- Status code validation
- JSON response validation
- Success flag verification
- Token management (auto-save from login)
- Authorization error detection

## Installation

The skill is already registered in `_bmad/custom/config.toml`.

### Make script executable (one-time)

```bash
chmod +x /Applications/MAMP/htdocs/Personal\ Projects/IMPOC/_bmad/custom/bmad-postman-collection-wrapper.sh
```

## Usage

### Option 1: Via Claude Code

```
me: Let's generate the Postman collection
Claude: I'll run the postman collection generator
```

The skill will:
1. Scan your API structure
2. Generate comprehensive collection
3. Output to `postman/postman-collection.json`

### Option 2: CLI

```bash
cd /Applications/MAMP/htdocs/Personal\ Projects/IMPOC
node _bmad/custom/bmad-postman-collection.js
```

### Option 3: Using the wrapper

```bash
bash _bmad/custom/bmad-postman-collection-wrapper.sh
```

## Importing into Postman

1. Open Postman desktop app
2. Click **File** → **Import**
3. Select: `postman/postman-collection.json`
4. Click **Import**

## Setting Up Environment Variables

After import, configure variables in Postman:

| Variable | Value | Note |
|----------|-------|------|
| `baseUrl` | `http://localhost:5000` | Your API URL |
| `accessToken` | Empty initially | Auto-filled by login |
| `refreshToken` | Empty initially | Auto-filled by login |
| `adminRoleUuid` | From DB | Get from `/api/roles` |
| `managerRoleUuid` | From DB | Get from `/api/roles` |
| Other role UUIDs | From DB | Get from `/api/roles` |

## Running Tests

### Login First

1. Go to **Auth** folder
2. Click **Login** request
3. Set username/password
4. Click **Send**
5. Tokens auto-save to environment

### Run Collection Tests

1. Click **Collections** in left sidebar
2. Right-click **IMPOC API**
3. Click **Run Collection**
4. Configure:
   - Environment: (your environment)
   - Iterations: 1
   - Delay: 100ms
5. Click **Run IMPOC API**

## Test Scenarios

### Happy Path
- Login with valid credentials
- Refresh token
- CRUD all entities
- Logout

### RBAC Testing
- Test each endpoint with each role
- Verify 403 Forbidden for unauthorized access
- Verify 200/201 for authorized access

### Validation Testing
- Invalid UUID format → 400 Bad Request
- Missing required fields → 400 Bad Request
- String length violations → 400 Bad Request

### Error Scenarios
- Non-existent resource → 404 Not Found
- Duplicate name → 409 Conflict
- Expired token → 401 Unauthorized
- Invalid token → 401 Unauthorized

## Extending the Skill

### Add New Endpoint

Edit `bmad-postman-collection.js`:

```javascript
{
    method: 'GET',
    path: '/api/new-endpoint',
    name: 'Endpoint Name',
    description: 'What it does',
    module: 'module_name',
    requiresAuth: true,
    permissions: ['permission.required'],
    body: { /* example payload */ },
}
```

Run generator again:
```bash
node _bmad/custom/bmad-postman-collection.js
```

### Add New Role Test

Edit role definitions in the script:

```javascript
const roles = [
    // ... existing roles
    { name: 'NEW_ROLE', uuid: '{{newRoleUuid}}', permissions: [] },
];
```

## Troubleshooting

### Collection not generated?
- Check output directory: `postman/`
- Verify script permissions: `chmod +x bmad-postman-collection-wrapper.sh`
- Check Node.js version: requires Node 14+

### Import fails?
- Ensure JSON is valid: open `postman-collection.json` in editor
- Check Postman version is latest
- Try File → Import → Paste Raw Text (copy file contents)

### Tests failing?
- Verify environment variables are set
- Check API is running on correct port
- Ensure user has correct permissions for test role
- Check request auth is set correctly

## Configuration

Skill settings in `_bmad/custom/config.toml`:

```toml
[skills.bmad-postman-collection]
module = "bmm"
display_name = "Postman Collection Generator"
menu_code = "PC"
description = "Scans API codebase and generates Postman collection..."
phase = "ship"
preceded_by = "bmad-build"
action = "generate"
output_location = "{project-root}/postman"
outputs = "postman-collection.json"
```

## Output Files

```
postman/
├── postman-collection.json       # Main collection file
└── README.md                      # This file
```

## Next Steps

1. ✅ Generate collection → `bmad-postman-collection`
2. ✅ Import to Postman
3. ✅ Configure environment
4. ✅ Run login endpoint
5. ✅ Run collection tests
6. ✅ Use for API documentation
7. ✅ Share with team

## Support

For issues or enhancements:
1. Check troubleshooting section
2. Review `bmad-postman-collection.js` for endpoint definitions
3. Update skill configuration in `_bmad/custom/config.toml`
4. Re-run generator

---

**Created**: August 2025  
**Skill**: bmad-postman-collection  
**Version**: 1.0.0
