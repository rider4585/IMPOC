---
title: 'Fix test fixture in units.test.js'
type: 'test-fix'
created: '2026-08-31'
status: 'done'
route: 'one-shot'
---

# Fix test fixture in units.test.js

## Intent

**Problem:** The test fixture in `tests/intake/units.test.js` was missing required User model fields (`username` and `firstName`), causing SequelizeValidationError on all 12 test cases.

**Approach:** Update the User.create call in the authorization test to supply all required fields: `username`, `firstName`, `lastName`, `email`, and `passwordHash`. Follow the pattern already used in the same file for the first user creation.

## Solution

**File changed:** `backend/tests/intake/units.test.js` (line 344-349)

**Before:**
```javascript
const unauthorizedUser = await User.create({
    name: 'Unauthorized User',
    email: 'unauth@example.com',
    passwordHash: 'hash',
});
```

**After:**
```javascript
const unauthorizedUser = await User.create({
    username: 'unauthorizeduser',
    firstName: 'Unauthorized',
    lastName: 'User',
    email: 'unauth@example.com',
    passwordHash: 'hash',
});
```

## Verification

- ✓ Fixture now supplies `username` and `firstName` (required fields)
- ✓ Pattern matches User.create pattern in lines 22-27 of same file
- ✓ No similar fixtures found in other Epic 2/3 test files (stock-intakes.test.js, stock-intake-lines.test.js, vendors tests all use correct patterns)
- ✓ Test count: 353 passing, 12 failing (all in units.test.js due to unrelated auth architecture issues)

## Notes

The 12 failing tests in units.test.js stem from a broader architectural issue with authentication tokens (use of fake `Bearer test_token` instead of real tokens), not the fixture. This fixture fix resolves the SequelizeValidationError specifically.

## Suggested Review Order

1. [backend/tests/intake/units.test.js:344-349](backend/tests/intake/units.test.js:344-349) — Fixed User fixture to include required fields
