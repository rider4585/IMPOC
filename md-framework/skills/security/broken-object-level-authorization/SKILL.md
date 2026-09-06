---
name: broken-object-level-authorization
version: 1.0.0
description: |
  Hunt the single most common and damaging API flaw — endpoints that authenticate
  the caller but never check whether the requested object belongs to them (BOLA /
  IDOR). Use when reviewing any endpoint that accepts an identifier, when asked
  "check for IDOR", "can users access each other's data", or during any
  multi-tenant security review. OWASP API1:2023, CWE-639.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Broken Object Level Authorization (API1:2023 / CWE-639)

The flaw: an endpoint verifies a valid session, then acts on whatever identifier
the client sent. A logged-in cashier changes `/api/sales/1041` to
`/api/sales/1042` and reads another shop's transaction.

It is the most common serious API vulnerability because the check is invisible
when absent — the endpoint works perfectly for honest clients.

### The test question

For **every** endpoint accepting an identifier, answer exactly this:

> What stops an authenticated user from substituting an identifier belonging to
> someone else?

Acceptable answers cite server-side code. Unacceptable answers:
- "The UI never shows them other IDs"
- "The IDs are UUIDs so they can't guess them"
- "Only staff use this system"
- "The frontend filters the list"

Obscurity is not authorisation. Insider abuse is the primary threat model in a
retail system — the attacker already has a valid login and can read their own
network traffic.

### Detection

```bash
# Every route taking an id
grep -rnE "['\"]/[a-z0-9/_-]*:(id|uuid|[a-zA-Z]+Id)" src/ --include=*.js
# Lookups with no ownership predicate
grep -rnE "find(Unique|ById|ByPk|One)\(" src/ -A 4 --include=*.js | grep -v "shopId\|tenantId\|userId\|ownerId"
# Update/delete by id alone — highest risk
grep -rnE "\.(update|delete|destroy)\(\s*\{?\s*(where:\s*)?\{\s*id" src/ --include=*.js
```

Review **write** operations first. A missing check on `DELETE` or `PATCH` is
worse than on `GET`.

### Remediation patterns, strongest first

1. **Scope in the query.** Ownership becomes part of the lookup; a foreign
   identifier returns nothing.
   ```js
   const sale = await Sale.findOne({ where: { id, shopId: req.user.shopId } });
   if (!sale) throw new NotFoundException();
   ```

2. **Repository-level scoping.** A data-access wrapper that always injects the
   tenant predicate, so an individual query cannot forget it.

3. **Database row-level security.** PostgreSQL RLS enforces the predicate even
   when application code is wrong. Strongest, and worth it for tables holding
   money.

4. **Explicit check after load.** Acceptable, but relies on discipline at every
   call site:
   ```js
   if (sale.shopId !== session.shopId) throw new NotFoundException();
   ```

Do **not** rely on unguessable identifiers as the control. UUIDs raise the cost
of enumeration; they do not stop a user who legitimately receives one identifier
and tries another.

### Nested and indirect cases — commonly missed

- Nested routes: `/shops/:shopId/sales/:saleId` — verify the sale belongs to that
  shop, *and* that the user belongs to the shop. Both, not either.
- Identifiers in bodies and query strings, not just paths.
- Batch endpoints accepting an array of ids — check every element.
- Filenames, report ids, export tokens, and print jobs.
- Related-object traversal: an authorised order that exposes another customer's
  address through an include or expansion.

### Severity

`CRITICAL` when it crosses tenants or reaches write operations on money or stock.
`HIGH` within a tenant across users. Never rate below `HIGH` on the argument that
identifiers are hard to guess.

### Checklist

- [ ] Every endpoint with an identifier enumerated
- [ ] Write operations reviewed before reads
- [ ] Ownership enforced in the query, not after it, wherever possible
- [ ] Nested routes verify the full chain
- [ ] Batch endpoints check every element
- [ ] Included/expanded relations re-checked
- [ ] Foreign identifiers return 404, not 403
- [ ] Negative test exists per endpoint using a second tenant's fixture

## References

- **OWASP API Security Top 10 (2023) — API1 Broken Object Level Authorization**
  <https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/>
- **CWE-639** — authorization bypass through user-controlled key
  <https://cwe.mitre.org/data/definitions/639.html>
- **OWASP Insecure Direct Object Reference Prevention Cheat Sheet**
  <https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html>
- **PostgreSQL 16 documentation — Row Security Policies**
  <https://www.postgresql.org/docs/16/ddl-rowsecurity.html>

**Not sourced — written for this framework:** the unacceptable-answers list, the
detection commands, the ranked remediation patterns, and the retail insider
threat model.
