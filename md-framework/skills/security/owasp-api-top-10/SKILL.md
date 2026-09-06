---
name: owasp-api-top-10
version: 1.0.0
description: |
  Review an HTTP API against the OWASP API Security Top 10 (2023) — the risks
  specific to APIs rather than rendered web applications. Use for any endpoint
  review, when asked "review this API for security", "check the endpoints", before
  exposing a new API surface, or as the API lane of a security review gate.
  Requires a complete route list; run project-api first if one does not exist.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## OWASP API Security Top 10 (2023)

APIs fail differently from web applications. The dominant failures are
authorisation flaws, not injection — an API hands out object identifiers and
then trusts the client not to change them.

**Prerequisite:** a complete route list. A review of an incomplete list is
worthless. See `project-api`.

### API1 — Broken Object Level Authorization (BOLA)

The single most common and most damaging API flaw.

For every route taking an identifier, answer: *what stops an authenticated user
from substituting another tenant's identifier?* Demand a server-side ownership
check on the query itself.

```js
// ❌ authenticated, but not authorised
const sale = await Sale.findByPk(id);

// ✅ ownership is part of the query
const sale = await Sale.findOne({ where: { id, shopId: req.user.shopId } });
```

→ `broken-object-level-authorization`

### API2 — Broken Authentication

Weak or missing authentication on some routes; token flaws; credential stuffing.
Check `alg: none`, unverified signatures, missing expiry, and tokens that survive
logout or password change.

→ `broken-authentication`, `authentication-security`, `session-security`

### API3 — Broken Object Property Level Authorization

Two directions, both findings:
- **Excessive data exposure** — response returns fields the client should not
  see (cost price, password hash, internal IDs, staff PII).
- **Mass assignment** — request body sets fields the client should not control
  (`role`, `price`, `isPaid`, `shopId`).

→ `excessive-data-exposure`, `mass-assignment`

### API4 — Unrestricted Resource Consumption

Missing rate limits and unbounded work. Check login, search, report generation,
bulk export, file upload size, and pagination limits. An endpoint accepting
`?limit=1000000` is a finding.

→ `rate-limiting`

### API5 — Broken Function Level Authorization

Role checks missing on some operations — typically admin routes reachable by a
normal user, or a `PATCH` guarded where the `PUT` is not. Enumerate operations
per role and test the negative case.

→ `authorization-security`

### API6 — Unrestricted Access to Sensitive Business Flows

Flows that are individually authorised but harmful in volume or sequence: bulk
purchase of limited stock, repeated refunds, discount enumeration, mass export of
the customer list. Requires business context, not just code reading.

### API7 — Server Side Request Forgery

Any server-side fetch of a client-supplied URL.

→ `ssrf`

### API8 — Security Misconfiguration

Permissive CORS (especially `origin: true` with credentials), missing security
headers, verbose errors, unnecessary HTTP methods, unpatched surfaces.

→ `security-misconfiguration`

### API9 — Improper Inventory Management

Undocumented, deprecated, or forgotten endpoints; old API versions still live;
staging surfaces reachable from the internet. You cannot secure what nobody
listed.

### API10 — Unsafe Consumption of APIs

Trusting third-party responses. Validate and bound data from integrations
(payment providers, suppliers, shipping) exactly as you would client input.

### Output

Per-endpoint table, then findings:

```markdown
| Method | Path | AuthN | Role | Object check | Validation | Rate limit | Verdict |
|---|---|---|---|---|---|---|---|
| GET | /api/sales/:id | ✅ | staff | ❌ **none** | ✅ | ❌ | API1 HIGH |
```

Report `PASS / FINDING / NOT APPLICABLE` per category, with a reason for any
`NOT APPLICABLE`.

## References

- **OWASP API Security Top 10 (2023)** — category definitions and ordering
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- **OWASP REST Security Cheat Sheet** — control guidance per category
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>
- **OWASP ASVS 4.0, V4 Access Control** — the function/object separation in
  API1 and API5
  <https://owasp.org/www-project-application-security-verification-standard/>

**Not sourced — written for this framework:** the Prisma/TypeScript code
contrast in API1, the retail business-flow abuse examples in API6, and the
prerequisite rule requiring a complete route list.
