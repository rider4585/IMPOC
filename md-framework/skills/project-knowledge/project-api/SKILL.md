---
name: project-api
version: 1.0.0
description: |
  Enumerate and document the complete HTTP surface of an existing project: every
  route, its authentication and authorisation requirement, request and response
  shape, and validation. Produces docs/project-knowledge/api.md as a route table.
  Use when asked to "document the API", "list the endpoints", "what routes exist",
  "map the API surface", or when starting Phase 0 discovery. Also use before any
  API security review, which needs a complete route list to be meaningful.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Project API Discovery

A route you did not find is a route nobody reviews. Completeness matters more
here than depth — an incomplete route table silently invalidates every downstream
security review.

### Confidence marking (mandatory)

`[verified]` (read the route definition, cited) · `[inferred]` · `[assumed]`
(Open Questions). Auth requirements in particular must be `[verified]` — an
`[inferred]` auth claim is worse than no claim, because it will be trusted.

### Method

1. **Find every registration point first.** Do not start with controllers. Start
   with wherever routes attach to the application:
   ```bash
   grep -rnE "\.(get|post|put|patch|delete|all)\(" src/ --include=*.js | head -50
   grep -rnE "@(Get|Post|Put|Patch|Delete|Controller)\(" src/ --include=*.js | head -50
   grep -rn "Router\(\)\|registerRoutes\|app.use(" src/ --include=*.js
   ```
   Include every entry point, not only REST: GraphQL resolvers, WebSocket
   handlers, webhook receivers, cron-triggered HTTP calls, and health endpoints.

2. **Resolve full paths.** A handler mounted under nested routers has a path you
   cannot see at the handler. Walk the mount chain and record the **complete**
   externally reachable path.

3. **Determine authentication per route.** Read the middleware chain — do not
   assume a global guard applies. Confirm the guard actually runs on this route.
   Record: none / authenticated / specific role.

4. **Determine object-level authorisation per route.** For every route accepting
   an identifier, answer one question: *what stops an authenticated user from
   passing an identifier belonging to someone else?* Record the check and its
   location, or record its absence. This is the highest-value field in the table.

5. **Capture request shape and validation.** Path params, query params, body
   schema, and where validation happens. A route with no boundary schema
   validation is a finding — note it.

6. **Capture response shape.** What is returned, and whether it is filtered
   server-side. Note any endpoint returning full database rows — over-exposure
   leaks cost prices, hashes, and internal identifiers.

7. **Note rate limiting and idempotency.** Which routes are limited, and which
   state-changing routes are safe to retry. Payment and stock-adjustment routes
   without idempotency are a correctness risk.

### Output

Write `docs/project-knowledge/api.md`. Lead with the complete table:

```markdown
| Method | Path | Auth | Role | Object check | Validation | Rate limit | Handler |
|--------|------|------|------|--------------|------------|-----------|---------|
| GET | /api/v1/products/:id | yes | staff | ✅ shop_id scoped `svc.ts:88` | zod `dto.ts:12` | no | `products.controller.ts:41` |
| GET | /api/v1/reports/:id | yes | any   | ❌ **none found** | none | no | `reports.controller.ts:23` |
```

Then per-group detail sections, followed by:

```markdown
## Conventions      — versioning, errors, pagination, casing
## Non-REST Surface — GraphQL, websockets, webhooks
## Gaps             — routes lacking auth, object checks, or validation
## Open Questions
```

Mark every missing object-level check with ❌ and surface it in **Gaps**. Do not
soften it — that column is why this document exists.

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md`.
- `propose` Open Questions to `god` in one batch.
- Hand the completed table to whoever performs API security review; their work is
  only as complete as this list.

## References

- **OpenAPI Specification 3.1** — the per-operation fields captured in steps 3–6
  (path, parameters, requestBody, responses, security)
  <https://spec.openapis.org/oas/v3.1.0.html>
- **OWASP API Security Top 10 (2023)** — API1 Broken Object Level Authorization
  motivates step 4; API3 Broken Object Property Level Authorization motivates
  step 6 <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- **Munder Difflin `PROTOCOL.md`** — memory write-back and `propose` handoff

**Not sourced — added deliberately:** the confidence marking, and the rule that
auth requirements may never be recorded as `[inferred]`.
