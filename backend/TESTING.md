# IMPOC Backend API - Test Suite Documentation

## Quick Start

### Installation
Tests are already configured. Just ensure dependencies are installed:
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests by Module
```bash
# Authentication module
npm run test:auth

# Users module
npm run test:users

# Roles module
npm run test:roles

# Permissions module
npm run test:permissions
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

## Test Structure

```
backend/
├── tests/
│   ├── auth/
│   │   └── auth.test.js          # Authentication & session tests (30+ tests)
│   ├── users/
│   │   ├── users.test.js         # User CRUD & RBAC tests (35+ tests)
│   │   └── user-roles.test.js    # User-role assignment tests (20+ tests)
│   ├── roles/
│   │   ├── roles.test.js         # Role CRUD tests (25+ tests)
│   │   └── role-permissions.test.js # Role-permission tests (25+ tests)
│   ├── permissions/
│   │   └── permissions.test.js   # Permission CRUD & security tests (30+ tests)
│   ├── utils/
│   │   └── test-setup.js         # Database setup & test utilities
│   └── setup.js                  # Jest setup file
├── jest.config.js                # Jest configuration
└── TESTING.md                    # This file
```

## Test Coverage

### Total Test Cases: 165+

| Module | File | Tests | Coverage Areas |
|--------|------|-------|-----------------|
| Auth | auth.test.js | 30+ | Login, token refresh, session management, logout |
| Users | users.test.js | 35+ | CRUD, RBAC, validation, conflicts, soft delete |
| Users | user-roles.test.js | 20+ | Role assignment, removal, validation |
| Roles | roles.test.js | 25+ | CRUD, uniqueness, cascade behavior |
| Roles | role-permissions.test.js | 25+ | Permission assignment, removal, validation |
| Permissions | permissions.test.js | 30+ | CRUD, security, XSS/SQL injection prevention |

## Test Scenarios

### 1. Authentication Tests
- ✅ Successful login with credentials
- ✅ Invalid credentials handling
- ✅ Token refresh and rotation
- ✅ Logout (single session and all sessions)
- ✅ Session revocation
- ✅ JWT validation

### 2. Role-Based Access Control (RBAC)
- ✅ ADMIN: Full system access
- ✅ MANAGER: User/sales/expense management
- ✅ INVENTORY_MANAGER: Inventory only
- ✅ CASHIER: POS operations
- ✅ ACCOUNTANT: Financial operations
- ✅ 403 Forbidden for unauthorized access

### 3. User Management
- ✅ Create users with validation
- ✅ Update user details
- ✅ Soft delete users
- ✅ Update user status (ACTIVE/INACTIVE/SUSPENDED)
- ✅ Duplicate username/email detection (409)
- ✅ Password validation (min 8 chars)
- ✅ Email format validation

### 4. Role Management
- ✅ Create roles with unique names
- ✅ Update role descriptions
- ✅ Delete roles (with cascade cleanup)
- ✅ Prevent deletion of roles with assigned users
- ✅ Case normalization (uppercase)

### 5. Permission Management
- ✅ Create permissions
- ✅ Update permissions
- ✅ Delete permissions
- ✅ Prevent deletion of permissions assigned to roles
- ✅ SQL injection prevention
- ✅ XSS payload handling

### 6. Error Handling
- ✅ 400 Bad Request - Invalid input
- ✅ 401 Unauthorized - Missing/invalid auth
- ✅ 403 Forbidden - Insufficient permissions
- ✅ 404 Not Found - Resource not found
- ✅ 409 Conflict - Constraint violations

### 7. Security Tests
- ✅ SQL injection attempt prevention
- ✅ XSS payload handling
- ✅ Password hashing verification
- ✅ Sensitive data protection (no passwords in responses)
- ✅ Refresh token rotation
- ✅ Session metadata tracking

## Database Setup

### Test Database
- Runs against its own database, named by `DB_NAME_TEST` — **never** `DB_NAME`.
  `initializeTestDatabase()` calls `sequelize.sync({ force: true })`, which
  DROPS and recreates every table it manages. `config/config.js` refuses to
  start the suite if `DB_NAME_TEST` is missing or equal to `DB_NAME`.
- Create it once: `createdb -U postgres IMPOC_test`
- Automatically synced before tests via `initializeTestDatabase()`
- Fresh schema for each test run
- Automatic cleanup after tests via `cleanupTestDatabase()`

### Pre-seeded Data
- **Roles**: ADMIN, MANAGER, INVENTORY_MANAGER, CASHIER, ACCOUNTANT
- **Permissions**: 20+ permissions across all modules
- **Test Users**: Created per test with appropriate roles

## Configuration

### Environment Variables
Located in `.env` file (already configured):
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=IMPOC
DB_NAME_TEST=IMPOC_test
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3001
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Jest Configuration (jest.config.js)
- **Test Environment**: Node.js
- **Test Timeout**: 15 seconds
- **Max Workers**: 1 (for database consistency)
- **Coverage**: Collected from `src/**/*.js`

## Running Specific Tests

### Run single test file
```bash
NODE_OPTIONS=--experimental-vm-modules jest tests/auth/auth.test.js --forceExit
```

### Run tests matching pattern
```bash
NODE_OPTIONS=--experimental-vm-modules jest --testNamePattern="should return 401"
```

### Run with coverage report
```bash
npm test -- --coverage
```

### Run in watch mode
```bash
npm run test:watch
```

## Test Helpers & Utilities

### Database Functions (`tests/utils/test-setup.js`)

#### `initializeTestDatabase()`
Syncs database schema and seeds test data:
```javascript
const db = await initializeTestDatabase();
```

#### `cleanupTestDatabase()`
Truncates all tables for test isolation:
```javascript
await cleanupTestDatabase();
```

#### `closeDatabase()`
Closes database connection:
```javascript
await closeDatabase();
```

### Data Generators

#### `generateTestUser(overrides)`
Creates random test user data:
```javascript
const user = generateTestUser({ password: 'Custom123!' });
```

#### `generateTestRole(overrides)`
Creates random test role data:
```javascript
const role = generateTestRole({ name: 'CUSTOM_ROLE' });
```

#### `generateTestPermission(overrides)`
Creates random test permission data:
```javascript
const perm = generateTestPermission({ name: 'custom.action' });
```

## Common Issues & Solutions

### Database Connection Error
**Problem**: `connect ECONNREFUSED 127.0.0.1:5432`
**Solution**: Ensure PostgreSQL is running and accessible
```bash
# macOS with Homebrew
brew services start postgresql

# Check status
pg_isready
```

### Port Already in Use
**Problem**: Test fails with port 3001 in use
**Solution**: The test suite doesn't start a server, but if it does:
```bash
lsof -i :3001
kill -9 <PID>
```

### Jest Module Error
**Problem**: `Cannot use import statement outside a module`
**Solution**: Already fixed in jest.config.js and package.json

### Database Lock/Timeout
**Problem**: Tests hang or timeout
**Solution**: Ensure `maxWorkers: 1` in jest.config.js for serial execution

## Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: IMPOC
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
```

## Debugging Tests

### Enable Detailed Logging
```bash
npm test -- --verbose
```

### Run single test
```bash
NODE_OPTIONS=--experimental-vm-modules jest tests/auth/auth.test.js -t "should login successfully"
```

### Debug in Node Inspector
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

## Writing New Tests

### Test Template
```javascript
import request from 'supertest';
import app from '../../app.js';
import * as db from '../../database/models/index.js';
import { initializeTestDatabase, cleanupTestDatabase, closeDatabase } from '../utils/test-setup.js';

describe('Feature Module - /api/feature', () => {
  let testDb;
  let adminToken;

  beforeAll(async () => {
    testDb = await initializeTestDatabase();
    // Setup admin user and get token
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /feature', () => {
    it('should return features', async () => {
      const res = await request(app)
        .get('/api/feature')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
```

### Best Practices
1. ✅ Use `beforeAll` for setup, `afterEach` for cleanup
2. ✅ Test happy path and error cases
3. ✅ Verify status codes and response structure
4. ✅ Test authorization for each endpoint
5. ✅ Use descriptive test names
6. ✅ Keep tests focused and independent

## Test Metrics

### Success Indicators
- ✅ All 165+ tests pass
- ✅ No errors in console output
- ✅ Tests complete in < 60 seconds
- ✅ Database cleanup successful
- ✅ No hanging connections

### Coverage Goals
- **Statements**: > 80%
- **Branches**: > 70%
- **Functions**: > 80%
- **Lines**: > 80%

View coverage report:
```bash
npm test -- --coverage
```

## Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **Supertest Documentation**: https://github.com/visionmedia/supertest
- **Sequelize Testing Guide**: https://sequelize.org/docs/v6/other-topics/queues/
- **Express Testing Patterns**: https://expressjs.com/en/guide/testing.html

## Support

For issues or questions about the tests:
1. Check `tests/utils/test-setup.js` for utility functions
2. Review similar test files for patterns
3. Ensure database is properly configured
4. Check Node.js version (requires 16+)
5. Review error messages carefully

---

**Last Updated**: 2026-08-19
**Test Suite Version**: 1.0.0
**Status**: Production Ready ✅
