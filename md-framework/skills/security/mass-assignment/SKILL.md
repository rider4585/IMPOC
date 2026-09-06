---
name: mass-assignment
version: 1.0.0
description: |
  Detect endpoints that bind a request body directly to a model or entity,
  letting a client set fields it should not control — role, price, tenant, paid
  status. Use when reviewing create/update endpoints, DTO handling, or ORM writes,
  or when asked "check for mass assignment". OWASP API3:2023, CWE-915.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Mass Assignment (API3:2023 / CWE-915)

An endpoint spreads the request body into a model write. The client sends an
extra field the developer never intended to expose, and the ORM obligingly
persists it.

```js
// ❌ whatever the client sends is written
await User.update(req.body, { where: { id } });

// client sends: { "name": "Ravi", "role": "owner" }
```

In a retail system the high-value targets are obvious: `role`, `unitPrice`,
`costPrice`, `discountPercent`, `shopId`, `isPaid`, `stockQuantity`,
`createdAt`. Any of these accepted from a request body is a finding.

### Detection

```bash
# Whole-body writes
grep -rnE "(create|update|save|insert)\(\s*\{?\s*(data:\s*)?(req\.body|body|dto)\s*[,}\)]" src/ --include=*.js
# Spread of request data into an entity
grep -rnE "\.\.\.(req\.body|body|dto|input)" src/ --include=*.js
# ORM bulk-assign helpers
grep -rnE "Object\.assign\(\s*(entity|model|user|product)" src/ --include=*.js
```

Then check each hit: is there an allow-list between the request and the write?

### Remediation

**Allow-list explicitly.** A denylist of dangerous fields fails the moment a new
sensitive column is added.

```js
// ✅ only these fields can ever be written from a request
const data = { name: dto.name, description: dto.description };
await Product.update(data, {
  where: { id, shopId: req.user.shopId },
  fields: ["name", "description"],        // allow-list, enforced by Sequelize
});
```

**Use a Zod schema that rejects unknown properties.** `.strict()` makes an
unexpected key an error instead of a silent strip, so an attempt to set a
privileged field surfaces rather than disappearing.

```js
const UpdateProduct = z.object({ name: z.string(), description: z.string() }).strict();
const data = UpdateProduct.parse(req.body);
```

**Separate read and write shapes.** The model you return and the model you accept
should be different types. Reusing one entity for both is the structural cause of
this whole class.

**Set authority server-side, always.** `shopId`, `userId`, `role`, and timestamps
come from the verified session or the server clock — never from the payload. See
`authorization-security`.

### Nested and indirect cases

- Nested objects: a permitted `address` sub-object may itself carry `id` and
  reassign an existing record.
- Array items in bulk endpoints — validate each element.
- `upsert`: the create branch often has a wider field set than the update branch.
- GraphQL input types with optional fields nobody reviewed.

### Severity

`CRITICAL` where `role`, `shopId`, or payment status can be set — that is
privilege escalation or cross-tenant write. `HIGH` for price, cost, and stock
fields. `MEDIUM` for metadata such as timestamps.

### Checklist

- [ ] No endpoint writes `req.body` or a spread of it directly
- [ ] Every write field allow-listed
- [ ] DTO validation strips or rejects unknown properties
- [ ] Read and write shapes are separate types
- [ ] Tenant, user, role, and timestamps set server-side
- [ ] Nested objects and array elements validated
- [ ] `upsert` create branch reviewed separately
- [ ] Negative test: extra privileged field is rejected or ignored

## References

- **OWASP API Security Top 10 (2023) — API3 Broken Object Property Level
  Authorization** (mass assignment half)
  <https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/>
- **OWASP Mass Assignment Cheat Sheet** — allow-list and separate-DTO guidance
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
- **CWE-915** <https://cwe.mitre.org/data/definitions/915.html>
- **Zod documentation — `.strict()`** <https://zod.dev/>
- **Sequelize documentation — Model instances and `fields` option** — limiting
  which attributes a create or update may write
  <https://sequelize.org/docs/v6/core-concepts/model-instances/>

**Not sourced — written for this framework:** the detection commands, the retail
sensitive-field list, and the severity mapping.
