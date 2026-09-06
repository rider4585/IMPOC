---
name: authorization
version: 1.0.0
description: |
  Implement access control in an Express application — role guards, object-level
  ownership checks, tenant scoping, and permission modelling. Use when adding a
  protected route, enforcing who may do what, or implementing multi-tenant data
  isolation. This is the build skill; for reviewing existing authorisation for
  flaws see authorization-security and broken-object-level-authorization.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Authorization (implementation)

Authentication established *who*. This is *may they, on this record*. The two
questions fail independently, so implement both:

- **Function-level** — may this role perform this operation at all?
- **Object-level** — may this user act on *this specific row*?

Route guards answer the first. Only the query can reliably answer the second.

### Define permissions once

Scattering role names through route files makes the model impossible to audit.

```js
// auth/permissions.js — the whole model, in one readable place
export const PERMISSIONS = {
  owner:   ['*'],
  manager: ['sale:create', 'sale:void', 'sale:refund', 'product:write',
            'product:read_cost', 'report:read', 'stock:adjust'],
  cashier: ['sale:create', 'product:read', 'stock:read'],
};

export const can = (role, permission) => {
  const granted = PERMISSIONS[role] ?? [];
  return granted.includes('*') || granted.includes(permission);
};
```

A permission string is better than a bare role check: `requireRole('manager')`
scattered everywhere has to be found and edited when a role is added, whereas
`require('sale:void')` keeps the mapping in one file.

### Function-level guard

```js
export const require = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ title: 'Authentication required', status: 401 });
  if (!can(req.user.role, permission)) {
    req.log.warn({ userId: req.user.sub, permission }, 'authorization denied');
    return res.status(403).json({ title: 'Not permitted', status: 403 });
  }
  next();
};
```

Apply at the router so a new route cannot be added unprotected by omission:

```js
router.use(requireAuth);
router.post('/',         require('sale:create'), validate(CreateSale), createSale);
router.post('/:id/void', require('sale:void'),   validate(VoidSale),   voidSale);
```

Log denials — a spike is either a broken UI or someone probing.

### Object-level: scope in the query

This is the part that gets skipped, and it is the more dangerous half.

```js
// ❌ authenticated, but any valid user can read any sale
const sale = await Sale.findByPk(req.validated.id);

// ✅ ownership is part of the query — a foreign id simply returns nothing
const sale = await Sale.findOne({
  where: { id: req.validated.id, shopId: req.user.shopId },
});
if (!sale) throw new NotFoundError();     // 404, not 403 — do not confirm existence
```

Prefer enforcing it **in the query** over loading then comparing: a `WHERE` clause
cannot be forgotten between the load and the check, and there is no window where
the row exists in memory unguarded.

Ranked, strongest first:

1. **PostgreSQL row-level security** — holds even when application code is wrong
2. **A repository layer that always injects the tenant predicate**
3. **Query-level `where` including the tenant** (the example above)
4. **Load then compare** — works, but relies on discipline at every call site

### Authority comes from the session, never the request

```js
// ❌ the client decides which shop it belongs to
const shopId = req.body.shopId;

// ✅
const shopId = req.user.shopId;
```

The same applies to `role`, `userId`, and any price or cost the server can look
up itself. Anything authority-bearing that arrives in a body or header is
attacker-controlled.

### Nested resources: check the whole chain

```js
// /sales/:saleId/lines/:lineId — verify the line belongs to the sale
// AND the sale belongs to the caller's shop
const line = await SaleLine.findOne({
  where: { id: lineId },
  include: [{ model: Sale, as: 'sale', where: { id: saleId, shopId: req.user.shopId }, required: true }],
});
```

`required: true` makes it an inner join, so a mismatch anywhere in the chain
yields no row. Checking only the leaf is a common and exploitable shortcut.

### Field-level permissions

Some fields are role-dependent rather than whole-resource. Cost price is the
canonical retail case:

```js
const attributes = can(req.user.role, 'product:read_cost')
  ? ['id', 'name', 'unitPrice', 'costPrice']
  : ['id', 'name', 'unitPrice'];

const products = await Product.findAll({ where: { shopId: req.user.shopId }, attributes });
```

Choose at the **query**, not by deleting fields before responding — the value
then never enters the process. See `excessive-data-exposure`.

### Privileged operations

Voids, refunds, price overrides, and stock adjustments need more than a role
check: an attributable audit record with actor, timestamp, and reason, written in
the same transaction as the effect. An unlogged override is an internal control
failure — see `logging` and `project-pos-rules`.

### Detection

```bash
grep -rnE "router\.(get|post|put|patch|delete)\(" src/ --include=*.js | grep -v "require(\|requireRole\|requireAuth"
grep -rnE "findByPk\(" src/ --include=*.js                                  # id alone, unscoped
grep -rnE "findOne\(|findAll\(" src/ -A 3 --include=*.js | grep -v "shopId\|tenantId\|userId"
grep -rnE "(body|query|params)\.(role|shopId|tenantId|userId|isAdmin)" src/ --include=*.js
```

The last one is the highest-signal check in this skill: authority read from the
request rather than the session.

### Checklist

- [ ] Permission model defined in one file, not scattered role strings
- [ ] Guards applied at router level
- [ ] Every identifier parameter has a server-side ownership check
- [ ] Ownership enforced in the query where possible
- [ ] Foreign records return `404`, not `403`
- [ ] Authority (`role`, `shopId`, `userId`) read from the session only
- [ ] Nested routes verify the full chain with `required: true`
- [ ] Role-dependent fields chosen via `attributes` at query time
- [ ] Denials logged
- [ ] Privileged operations write an attributable audit record in the same transaction
- [ ] Negative tests exist: wrong role, and another tenant's object

## References

- **OWASP Authorization Cheat Sheet** — enforcement placement, deny by default
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>
- **OWASP ASVS 4.0, V4 Access Control** — function/object separation
  <https://owasp.org/www-project-application-security-verification-standard/>
- **OWASP API Security Top 10 (2023) — API1 / API5**
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- **PostgreSQL 16 documentation — Row Security Policies**
  <https://www.postgresql.org/docs/16/ddl-rowsecurity.html>
- **Sequelize v6 — Eager loading (`required`) and `attributes`**
  <https://sequelize.org/docs/v6/core-concepts/assocs/>

**Not sourced — written for this framework:** the permission-string model, the
ranked enforcement options, the retail cost-price field example, the nested-chain
pattern, and the detection commands.
