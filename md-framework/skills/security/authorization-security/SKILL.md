---
name: authorization-security
version: 1.0.0
description: |
  Verify that access control is correctly enforced — function-level and
  object-level, server-side, deny-by-default — across routes, services, and
  queries. Use when reviewing any protected operation, when asked "check
  permissions", "is this properly authorised", or as the access-control lane of a
  security review. CWE-285, CWE-862, CWE-863.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Authorization Security (CWE-862 / CWE-863)

Authentication answers *who*. Authorisation answers *may they, on this record*.
Broken access control is the most common serious category in modern applications,
and the two halves fail independently.

### The two questions — always check both

1. **Function-level:** may this role invoke this operation at all?
   Failure: a cashier reaching `DELETE /api/products/:id`.
2. **Object-level:** may this user act on *this specific record*?
   Failure: a cashier at shop A reading shop B's sale by changing the id.

A system can enforce the first flawlessly and the second not at all. Check them
separately, and record them in separate columns.

### Core principles

- **Deny by default.** Access requires an explicit grant. A route with no guard
  must fail closed, not open. Check the framework default and any global guard —
  then confirm it actually applies to the route in question.
- **Enforce server-side, at the lowest layer that owns the data.** A UI that
  hides a button is not a control. A route guard is bypassed by any internal
  caller. The strongest placement is in the query itself.
- **Authorise on the object, not on the input.** Load the record, then compare
  its owner to the session — or better, make ownership part of the `WHERE`.

```js
// ❌ trusts the client's claim about scope
const sale = await Sale.findByPk(req.validated.id);

// ✅ scope is enforced in the query; a foreign id simply returns nothing
const sale = await Sale.findOne({
  where: { id: req.validated.id, shopId: req.user.shopId },
});
if (!sale) throw new NotFoundException();
```

- **Fail identically for "absent" and "forbidden".** Returning 403 for existing
  records and 404 for missing ones confirms existence to an attacker.

### Detection

```bash
# Operations reachable without a guard
grep -rnE "@(Get|Post|Put|Patch|Delete)\(" src/ -A 3 --include=*.js | grep -B 3 -v "Roles\|UseGuards"
# Lookups by id with no scoping
grep -rnE "find(Unique|ByPk|One|ById)\(\s*\{?\s*(where:\s*)?\{\s*id" src/ --include=*.js
# Authority taken from the request instead of the session
grep -rnE "(body|query|params)\.(role|isAdmin|shopId|tenantId|userId)" src/ --include=*.js
```

The third pattern is especially important: any authority value read from the
request rather than the verified session is a finding on its own.

### Multi-tenant scoping

Where rows belong to a shop or tenant, the scoping predicate must be
unavoidable. Query-level scoping, a repository wrapper that always injects it, or
PostgreSQL row-level security are all acceptable. "Every developer remembers to
add `shopId`" is not — verify per query path and list the ones that miss it.

### Privileged escapes

Admin overrides, service accounts, internal API keys, and debug flags are part of
the model. Each must be enumerated, restricted, and logged attributably.

### Severity

`CRITICAL` for cross-tenant access or role escalation. `HIGH` for missing
object-level checks within a tenant, and for missing function-level checks on
money, stock, or user management. `MEDIUM` for information-only exposure.

### Checklist

- [ ] Every protected operation has an explicit function-level check
- [ ] Every identifier parameter has a server-side object-level check
- [ ] Authority read from the session, never from the request body
- [ ] Tenant scoping enforced structurally, verified per query path
- [ ] Deny-by-default confirmed for unguarded routes
- [ ] 403/404 responses do not disclose existence
- [ ] Privileged escapes enumerated and logged
- [ ] Negative tests exist — wrong role and foreign object both rejected

## References

- **OWASP ASVS 4.0, V4 Access Control** — function/object separation, deny by
  default, server-side enforcement
  <https://owasp.org/www-project-application-security-verification-standard/>
- **OWASP Authorization Cheat Sheet** — enforcement placement and testing
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>
- **OWASP Top 10 (2021) A01 Broken Access Control**
  <https://owasp.org/Top10/A01_2021-Broken_Access_Control/>
- **CWE-862** (missing authorization), **CWE-863** (incorrect authorization)
  <https://cwe.mitre.org/data/definitions/862.html>
- **PostgreSQL 16 documentation — Row Security Policies** — structural tenant
  scoping option <https://www.postgresql.org/docs/16/ddl-rowsecurity.html>

**Not sourced — written for this framework:** the detection commands, the
authority-from-request pattern, the Prisma-style code contrast, and the
multi-tenant enforcement ranking.
