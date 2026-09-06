---
name: api-design
version: 1.0.0
description: |
  Design API contracts — resource modelling, granularity, compatibility and
  versioning, consistency, and the shape of what clients depend on. Shared by
  architect and backend agents. Use when designing a new API surface, when
  clients need many round trips, or before a breaking change. For HTTP mechanics
  see rest-api.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## API Design

An API is a contract you cannot casually change. `rest-api` covers the mechanics —
methods, status codes, pagination. This covers the decisions made **before**
that: what resources exist, how coarse they are, and how the contract evolves.

### Design from the client's use case

The most common failure is exposing the data model directly and leaving clients
to assemble it.

```
❌ Client makes 5 calls to render one till screen:
   GET /products/:id  →  GET /stock/:productId  →  GET /prices/:productId
   →  GET /promotions?productId=  →  GET /tax-rates/:categoryId

✅ One call answering the actual question:
   GET /products/:id/pos-view
   → { id, name, sku, unitPrice, taxRate, availableQty, activePromotion }
```

Start from the screen or the task, not the tables. Every extra round trip is
latency the user feels — and on a till, over shop wifi, that is the difference
between a queue moving and not.

This does **not** mean one endpoint per screen. It means the resource should be
the thing the client conceptually needs.

### Granularity

| Too fine | Too coarse |
|---|---|
| Many round trips | Over-fetching |
| Client assembles business logic | Cache invalidation becomes broad |
| N+1 at the network layer | Response is different for every caller |

Aim for the middle: resources that are meaningful units of the domain. Where one
client genuinely needs a different shape, add a **named projection**
(`?view=pos`, or a distinct sub-resource) rather than bending the main resource
with optional flags, and never let clients specify arbitrary field sets — that
makes every field permanently public and defeats
`excessive-data-exposure` controls.

### Model actions explicitly

CRUD does not express a retail domain. Operations with their own rules,
permissions, and audit requirements deserve their own contract.

```
POST /sales/:id/void        { reason }
POST /sales/:id/refund      { lines, reason }
POST /stock/adjustments     { productId, delta, reason }
POST /tills/:id/close       { declaredCash }
```

Hiding "void a sale" inside `PATCH /sales/:id { status: 'void' }` means the
permission model, validation, and audit trail all have to be inferred from the
payload. An explicit action endpoint makes each of those a property of the
contract.

### Consistency beats local optimisation

Pick conventions once and never deviate — field casing, date format (ISO 8601
with timezone), money representation, id types, error shape, pagination
envelope, and null vs omitted.

An API where three endpoints disagree about how money is represented will produce
a bug in every client that touches all three. Consistency is the single
highest-value property of a contract.

**Money in particular:** decide integer minor units or decimal string, document
it, and apply it everywhere including nested objects and reports. See
`javascript`.

### Compatibility

Know which changes break clients.

| Additive (safe) | Breaking |
|---|---|
| New endpoint | Removing an endpoint or field |
| New **optional** request field | New **required** request field |
| New response field | Renaming a field |
| New optional query parameter | Changing a type or format |
| New enum value the client may ignore | Narrowing a range, or a new enum value the client must handle |
| Relaxing validation | Tightening validation |

Two subtleties: a new enum value **is** breaking if clients switch exhaustively
on it; and adding a response field is only safe if clients ignore unknown fields
— state that expectation in the contract.

**Version from day one** (`/api/v1`). Breaking changes go to a new version, with
the old one supported through a stated deprecation window. Never break a live
version because "nobody uses that field" — you cannot know that.

### Design for authorisation from the start

The contract determines whether authorisation is expressible.

- Every resource must be **scopable to a tenant**. An endpoint whose identifier
  cannot be scoped to a shop cannot be secured — see
  `broken-object-level-authorization`.
- Response shape may legitimately differ by role (cost price for managers, not
  cashiers). Design that as separate projections, not conditional field
  stripping.
- Never accept authority in a payload — `shopId`, `role`, and prices come from
  the session or the server. A price field in a create-sale request is a design
  defect, not just an implementation one.

### Idempotency is a contract property

Any endpoint that moves money or stock must be safe to retry, and must **say so**
in its contract — the accepted header, the scope of the key, and how long it is
honoured. Clients cannot implement correct retry against an unstated guarantee.
See `rest-api`.

### Document the contract, not the implementation

Whatever the format — OpenAPI, or the project's Postman collection — it must
state per endpoint: purpose, auth and role, request shape with constraints,
response shape, error cases with codes, idempotency, and rate limits.

Keep it with the code so it drifts less, and treat drift as a defect.

### Checklist

- [ ] Designed from client use cases, not from tables
- [ ] Round trips for common screens counted and minimised
- [ ] Resources are meaningful domain units; variants are named projections
- [ ] Clients cannot request arbitrary field sets
- [ ] Non-CRUD operations modelled as explicit actions
- [ ] Conventions consistent across every endpoint
- [ ] Money representation decided, documented, applied everywhere
- [ ] Every planned change classified additive or breaking
- [ ] Versioned from the first release; deprecation window stated
- [ ] Every resource scopable to a tenant
- [ ] Role-varying responses designed as projections
- [ ] No authority accepted in request payloads
- [ ] Idempotency guarantees stated in the contract
- [ ] Contract documented alongside the code

## References

- **RFC 9110 — HTTP Semantics** — method and status semantics underlying the
  contract <https://datatracker.ietf.org/doc/html/rfc9110>
- **OpenAPI Specification 3.1** — contract documentation structure
  <https://spec.openapis.org/oas/v3.1.0.html>
- **Martin Fowler — Published Interface / Tolerant Reader** — compatibility and
  ignoring unknown fields
  <https://martinfowler.com/bliki/TolerantReader.html>
- **OWASP API Security Top 10 (2023)** — API1 and API3, which the tenancy and
  projection rules address
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- **Google — API Improvement Proposals (AIP)** — resource modelling and
  compatibility conventions <https://google.aip.dev/>

**Not sourced — written for this framework:** the till round-trip example, the
granularity table, the explicit-action argument for void/refund, the
compatibility table's enum subtleties, and the checklist.
