---
name: authentication-testing
version: 1.0.0
description: |
  Test authentication and authorisation from the outside — login, sessions,
  tokens, role boundaries, and cross-tenant access. Use when testing any
  protected feature, before releasing auth changes, or when asked "can this be
  bypassed". Testing counterpart to the authentication and authorization build
  skills.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Authentication & Authorization Testing

Access control is the area where a defect is worst and a passing test suite is
most misleading — because the happy path works perfectly while the boundary is
wide open.

**Test the negatives.** A suite that only proves authorised users can act proves
nothing about access control.

### Login

| Case | Expected |
|---|---|
| Valid credentials | Authenticated; session established |
| Wrong password | 401, generic message |
| Unknown email | **Identical** response and timing to wrong password |
| Disabled account | 401, no distinguishing message |
| Empty or malformed input | 400, no authentication attempted |
| Repeated failures | Rate limited / locked out |
| Correct password, wrong case | Rejected |

The enumeration test matters: compare both the **response body and the response
time** between unknown-user and wrong-password. A measurable difference is a user
enumeration defect — see `authentication-security`.

```js
it('does not reveal whether an account exists', async () => {
  const a = await login('nobody@test.local', 'wrong');
  const b = await login('cashier@test.local', 'wrong');
  expect(a.status).toBe(b.status);
  expect(a.body).toEqual(b.body);
});
```

### Sessions and tokens

- Session token is `HttpOnly`, `Secure`, `SameSite` — assert the cookie
  attributes, not just that login worked
- Token rejected after logout
- Token rejected after password change
- Token rejected after the account is disabled
- Expired token rejected
- Tampered token rejected — modify a claim and re-sign with a different key
- `alg: none` token rejected
- Token from another environment rejected (`issuer`/`audience`)
- Idle and absolute timeouts enforced server-side

```js
it('rejects a token after logout', async () => {
  const cookie = await authCookie(cashier);
  await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
  await request(app).get('/api/v1/sales').set('Cookie', cookie).expect(401);
});
```

Clearing the cookie client-side is not logout — this test is what proves
server-side revocation exists.

### The permission matrix

Test **every role against every protected operation**, including the negatives.
This is tedious and it is the point.

```js
const cases = [
  ['owner',   'sale:void',      200],
  ['manager', 'sale:void',      200],
  ['cashier', 'sale:void',      403],
  ['cashier', 'product:read_cost', 403],
  ['manager', 'user:create',    403],
];
```

Generate the matrix from the permission model so a new role or operation cannot
silently arrive untested.

### Cross-tenant access — the highest-value test

```js
it('does not expose another shop\'s sale', async () => {
  const other = await seedSale({ shopId: otherShop.id });
  await request(app).get(`/api/v1/sales/${other.id}`)
    .set('Cookie', await authCookie(cashier))
    .expect(404);                    // 404, not 403 — existence not confirmed
});
```

Run this for **every endpoint taking an identifier**, and for writes as well as
reads. Missing object-level authorisation is the most common serious API flaw —
see `broken-object-level-authorization`.

Cover the indirect routes too: nested paths, ids in bodies and query strings,
batch endpoints, and related records reachable through an include.

### Privilege escalation

- Sending `role` in a profile update body — must be ignored
- Sending `shopId` to act on another tenant — must be ignored
- Changing an id in a URL to an admin-owned record
- Reaching an admin route directly, bypassing the UI
- Using a valid low-privilege token on a high-privilege endpoint

```js
it('ignores a role field in a profile update', async () => {
  await request(app).patch('/api/v1/users/me')
    .set('Cookie', await authCookie(cashier))
    .send({ name: 'X', role: 'owner' });
  expect((await User.findByPk(cashier.id)).role).toBe('cashier');
});
```

### Password reset

- Token single-use — the second attempt fails
- Token expires
- Token from another user rejected
- Reset invalidates all existing sessions
- Response identical for known and unknown addresses
- Token not exposed in a URL that reaches `Referer` or logs

### Retail-specific

- **A shared till session** — does it time out between staff? On a shared
  terminal an unattended session is another cashier's session.
- **Manager override** during a cashier's session must not persist as elevated
  access after the override completes.
- **Role changed mid-session** — does the old token still work?
- **A departed staff member's** token, after disablement.

### Automating the boundary

Rather than writing each case by hand, drive the matrix from the route list and
the permission model:

```bash
grep -rnE "router\.(get|post|put|patch|delete)\(" src/ --include=*.js
```

Every route should appear in the test matrix. A route not in it is untested
access control — see `project-api`.

### Checklist

- [ ] Unknown-user and wrong-password responses identical in body and timing
- [ ] Rate limiting and lockout verified
- [ ] Cookie attributes asserted
- [ ] Token rejected after logout, password change, and disablement
- [ ] Expired, tampered, `alg: none`, and foreign-issuer tokens rejected
- [ ] Timeouts enforced server-side
- [ ] Full role × operation matrix tested, generated from the permission model
- [ ] Cross-tenant 404 test for every identifier endpoint, reads and writes
- [ ] Nested, batch, and included-relation routes covered
- [ ] Privilege escalation via body fields tested and ignored
- [ ] Reset tokens single-use, expiring, and session-invalidating
- [ ] Shared-till timeout and manager-override scope tested
- [ ] Every route present in the matrix

## References

- **OWASP Web Security Testing Guide v4.2 — Authentication and Authorization
  Testing** <https://owasp.org/www-project-web-security-testing-guide/>
- **OWASP ASVS 4.0, V2 Authentication and V4 Access Control**
  <https://owasp.org/www-project-application-security-verification-standard/>
- **OWASP API Security Top 10 (2023) — API1, API2, API5**
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- **RFC 8725 — JWT Best Current Practices** — the token tampering cases
  <https://datatracker.ietf.org/doc/html/rfc8725>

**Not sourced — written for this framework:** the retail cases (shared till
timeout, manager override scope, mid-session role change), the matrix-generation
approach, and the requirement that every route appear in the matrix.
