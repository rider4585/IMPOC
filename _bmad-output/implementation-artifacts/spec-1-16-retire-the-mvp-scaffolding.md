---
title: 'Story 1.16 — Retire the MVP scaffolding'
type: 'chore'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
story_key: '1-16-retire-the-mvp-scaffolding'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** StockIntakeForm.jsx is MVP scaffolding with a broken test file that blocks the test suite. The flaky auth tests have dozens of "An update to AuthProvider inside a test was not wrapped in act(...)" warnings because async state updates in AuthProvider are not being awaited. Auth underpins every screen going forward, so a test that passes intermittently is worse than one that fails consistently — it teaches teams to ignore red.

**Approach:** Delete StockIntakeForm.jsx (the MVP UI scaffolding) and its broken test file. Fix the auth tests by properly awaiting async operations and wrapping state updates in act(). Keep the ZXing barcode-decode logic in BarcodeScanner.jsx intact.

## Boundaries & Constraints

**Always:** 
- Preserve BarcodeScanner.jsx and barcodeApi.js — these carry the ZXing decode logic, the real asset
- Keep AuthProvider.jsx as-is; fix only the tests, not the provider
- Do not suppress act() warnings; eliminate them by fixing the root cause
- Run the auth test suite three times in a row after the fix, report all three results

**Ask First:** None

**Never:** 
- Delete any ZXing-related decode logic
- Modify the AuthProvider implementation (the fix lives in tests only, unless diagnosis shows genuine provider bugs)
- Treat a single green run as proof of fix

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Test suite run after cleanup | Files deleted + tests fixed | All auth tests pass consistently across 3 runs, zero act() warnings | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/components/StockIntakeForm.jsx` -- MVP scaffolding UI for stock intake scanning, full component with size-run mode logic, to be **deleted**
- `frontend/src/components/__tests__/StockIntakeForm.test.js` -- test file for scaffolding component, syntax error ("Expression expected"), to be **deleted**
- `frontend/src/components/BarcodeScanner.jsx` -- real ZXing barcode-decode component, **preserve**
- `frontend/src/services/barcodeApi.js` -- barcode API calls, **preserve**
- `frontend/src/auth/AuthProvider.jsx` -- auth state management with boot-time session restore and token management, **keep as-is**
- `frontend/src/__tests__/auth.test.jsx` -- auth tests with act() warnings caused by unwaited async state updates in useEffect (lines 77–116 of AuthProvider), **fix**

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/components/StockIntakeForm.jsx` -- Delete file -- MVP scaffolding, Epic 3 will build the real intake screens
- [x] `frontend/src/components/__tests__/StockIntakeForm.test.js` -- Delete file -- This test file has been failing to parse with "Expression expected" and blocks test suite
- [x] `frontend/src/__tests__/auth.test.jsx` -- Fix flaky tests -- AuthProvider's `restoreSession()` useEffect (lines 77–116) calls async functions and sets state without proper awaiting. Tests see flaky results because state updates race with assertions. Wrap all async state-setting calls in act(); ensure every waitFor() properly awaits settled state before assertions. Eliminate all "not wrapped in act(...)" warnings.

**Acceptance Criteria:**
- Given the test suite is run, when `npm run test` executes, then all auth tests pass with zero act() warnings
- Given the auth test suite is run three times in sequence, when each run completes, then all three runs show green (100% pass rate, no variance)

## Design Notes

The auth tests fail intermittently because the `restoreSession()` effect in AuthProvider (lines 77–116) is async but the state updates it triggers are not being awaited in tests. The pattern is:

```javascript
useEffect(() => {
  const restoreSession = async () => {
    // ... async calls ...
    setAccessToken(data.accessToken);  // state update NOT awaited by test
    setCurrentUser(...);                // state update NOT awaited by test
    setStatus('signed-in');             // state update NOT awaited by test
  };
  restoreSession();  // async function called but NOT awaited
}, []);
```

When a test fires `fireEvent.click()`, the component's async state updates may or may not have settled by the time assertions run. The fix wraps state-setting code paths in `act()` so tests know when to wait:

```javascript
await act(async () => {
  await refreshAPI();
  // state updates now wrapped
  setAccessToken(...);
});
```

The key insight: the provider itself is correct — the issue is that tests must treat async state changes as async test concerns, not provider bugs.

## Verification

**Commands:**
- `cd frontend && npm run test -- auth.test.jsx` -- expected: all tests pass, zero act() warnings
- `cd frontend && npm run test -- auth.test.jsx && npm run test -- auth.test.jsx && npm run test -- auth.test.jsx` -- expected: three consecutive runs all pass, zero variance

## Suggested Review Order

**Scaffolding Removal**

- MVP stock intake form UI — temporary scaffolding, real screens built in Epic 3
  [`StockIntakeForm.jsx`](../../../frontend/src/components/StockIntakeForm.jsx) (deleted)

- Test file for scaffolding component — cleanup paired with component deletion
  [`StockIntakeForm.test.js`](../../../frontend/src/components/__tests__/StockIntakeForm.test.js) (deleted)

**Test Infrastructure Fixes**

- Helper function to wait for session restore before assertions; prevents act() warnings
  [`auth.test.jsx:74-80`](../../../frontend/src/__tests__/auth.test.jsx#L74)

- Wrap async sign-in and state transitions in act() boundaries; ensures test sees settled state
  [`auth.test.jsx:88-106`](../../../frontend/src/__tests__/auth.test.jsx#L88)

- Add missing authApi.refresh mock rejections; prevents undefined async behavior in tests
  [`auth.test.jsx:90, 126, 193, 223`](../../../frontend/src/__tests__/auth.test.jsx#L90)
