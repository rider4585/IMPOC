---
name: rest-api
version: 1.0.0
description: |
  Design and implement HTTP APIs consistently — resource naming, method and
  status code semantics, pagination, filtering, versioning, and idempotency. Use
  when adding or changing endpoints, when responses are inconsistent across the
  API, or when asked "what status code should this return".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## REST API

Consistency matters more than purity. A predictable API that bends REST in one
documented way beats a doctrinaire one that surprises clients.

### Resources and naming

```
GET    /api/v1/products              list
POST   /api/v1/products              create
GET    /api/v1/products/:id          read
PATCH  /api/v1/products/:id          partial update
DELETE /api/v1/products/:id          delete
GET    /api/v1/sales/:id/lines       sub-resource
POST   /api/v1/sales/:id/void        action that isn't CRUD
```

- Plural nouns for collections. Not `/getProduct`, not `/product-list`.
- Nest only one level deep. `/sales/:id/lines` is fine;
  `/shops/:id/sales/:id/lines/:id` is not — link by id instead.
- **Actions that are not CRUD get a verb sub-resource** (`/void`, `/refund`,
  `/close`). Forcing "void a sale" into `PATCH /sales/:id {status:'void'}` hides
  a distinct operation with distinct rules and permissions behind a generic
  update. Model it explicitly.
- One casing convention for JSON fields, applied everywhere.

### Methods

| Method | Semantics | Safe | Idempotent |
|---|---|---|---|
| `GET` | Read. **Never** changes state | ✅ | ✅ |
| `POST` | Create, or a non-idempotent action | ❌ | ❌ |
| `PUT` | Replace whole resource | ❌ | ✅ |
| `PATCH` | Partial update | ❌ | ❌ |
| `DELETE` | Remove | ❌ | ✅ |

A `GET` that changes state is both a correctness bug and a CSRF vector — see
`csrf`.

### Status codes

Use the small set consistently; do not improvise.

| Code | When |
|---|---|
| `200` | Success with a body |
| `201` | Created — include a `Location` header |
| `204` | Success, no body (typically `DELETE`) |
| `400` | Malformed request or failed validation |
| `401` | Not authenticated (or credentials invalid) |
| `403` | Authenticated but not permitted |
| `404` | Not found — **also** use for records outside the caller's tenant |
| `409` | Conflict — duplicate, or a state that forbids the operation |
| `422` | Well-formed but semantically invalid, if you distinguish it from 400 |
| `429` | Rate limited — include `Retry-After` |
| `500` | Unexpected server fault |

Two rules worth stating explicitly:

- **`401` is authentication, `403` is authorisation.** They are routinely swapped.
- **Return `404`, not `403`, for another tenant's record.** A `403` confirms the
  record exists, which is an information leak — see
  `broken-object-level-authorization`.

Insufficient stock, voiding a closed sale, or refunding beyond the original are
all `409` — the request is valid, the state forbids it.

### Error format — pick one and never deviate

Follow RFC 9457 Problem Details, or a documented shape of your own:

```json
{
  "type": "https://api.example.com/errors/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Product 4821 has 2 units available, 5 requested.",
  "instance": "/api/v1/sales",
  "requestId": "01JD8…",
  "errors": { "lines.0.quantity": ["exceeds available stock"] }
}
```

Always include a correlation id so a user's report maps to a log entry. Never
leak stack traces, SQL, or internal paths — see `security-misconfiguration`.

### Pagination

Be consistent across every list endpoint, and **always bound the page size
server-side**.

```js
const limit = Math.min(Number(req.query.limit) || 25, 100);
```

Keyset pagination for large or deep collections; offset only for small, shallow
ones. See `query-optimization`.

```json
{ "data": [...], "page": { "limit": 25, "nextCursor": "eyJzb2xkQXQiOi..." } }
```

### Filtering and sorting

- Filters as explicit query parameters: `?status=open&from=2026-09-01`.
- **Allow-list sortable fields.** `?sort=` mapped through a fixed object, never
  interpolated into SQL — see `sql-injection`.
- Reject unknown query parameters rather than ignoring them; a typo'd filter that
  silently returns everything is worse than an error.

### Idempotency

Any endpoint that moves money or stock must be safe to retry. Networks fail after
the server committed; the client cannot know.

```
POST /api/v1/sales
Idempotency-Key: 8f14e45f-ea1c-4b39-a0ff-1d2e3f4a5b6c
```

Store the key with the result, unique-constrained, in the same transaction as the
effect. A repeat returns the original response instead of charging twice — see
`concurrency`.

### Versioning

Version from the first release: `/api/v1`. Breaking changes go to `v2`;
additive changes do not. A new optional field is additive. Removing a field,
renaming one, or narrowing a type is breaking — even if no client appears to use
it.

### Detection

```bash
grep -rnE "res\.status\(\s*[0-9]{3}\s*\)" src/ --include=*.js | awk -F'status\\(' '{print $2}' | sort | uniq -c | sort -rn
grep -rnE "router\.get\(" src/ -A 6 --include=*.js | grep -iE "create|update|delete|void|refund"
grep -rnE "(limit|pageSize)" src/ --include=*.js | grep -v "Math.min"
grep -rn "Idempotency-Key\|idempotencyKey" src/ --include=*.js
```

The first command shows status-code usage at a glance — an API using fifteen
different codes inconsistently is visible immediately.

### Checklist

- [ ] Plural noun resources; nesting at most one level
- [ ] Non-CRUD operations modelled as explicit action sub-resources
- [ ] No `GET` changes state
- [ ] Status codes used consistently; `401` vs `403` correct
- [ ] Foreign-tenant records return `404`, not `403`
- [ ] One error shape everywhere, with a correlation id
- [ ] No stack traces or SQL in responses
- [ ] Page size bounded server-side on every list endpoint
- [ ] Sortable and filterable fields allow-listed
- [ ] Unknown query parameters rejected
- [ ] Money- and stock-moving endpoints accept an idempotency key
- [ ] API mounted under a version prefix

## References

- **RFC 9110 — HTTP Semantics** — method safety/idempotency and status code
  definitions <https://datatracker.ietf.org/doc/html/rfc9110>
- **RFC 9457 — Problem Details for HTTP APIs** — the error response shape
  <https://datatracker.ietf.org/doc/html/rfc9457>
- **OWASP REST Security Cheat Sheet** — validation, error handling, and exposure
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>
- **Stripe API documentation — Idempotent Requests** — the header and storage
  model <https://docs.stripe.com/api/idempotent_requests>
- **RFC 6585 §4** — `429 Too Many Requests` and `Retry-After`
  <https://datatracker.ietf.org/doc/html/rfc6585>

**Not sourced — written for this framework:** the action-sub-resource rule for
void/refund, the retail `409` examples, the detection commands, and the
checklist.
