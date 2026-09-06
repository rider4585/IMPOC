---
name: rate-limiting
version: 1.0.0
description: |
  Identify endpoints that need throttling and verify limits are correctly scoped
  and enforced — login, search, exports, uploads, and unbounded queries. Use when
  reviewing authentication endpoints, expensive operations, or public APIs, or
  when asked "do we have rate limiting". OWASP API4:2023, CWE-770, CWE-307.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Rate Limiting & Resource Consumption (API4:2023)

Two distinct problems. **Abuse throttling** stops guessing and enumeration.
**Resource bounding** stops one request consuming disproportionate work. An
endpoint can be rate limited and still be trivially overloaded by
`?limit=1000000`.

### What must be limited

| Endpoint class | Why | Suggested scope |
|---|---|---|
| Login, password reset, MFA | Credential stuffing, brute force | Per account **and** per IP |
| Token refresh | Token farming | Per session |
| Search, autocomplete | Expensive queries, scraping | Per user |
| Report generation, exports | Heavy DB and memory | Per user, low limit + queue |
| File upload, import | Storage and parser cost | Per user, with size cap |
| Webhook registration | SSRF probing | Per user |
| Any public unauthenticated route | Everything | Per IP |

### Correct scoping

Scope is where limits usually fail:

- **Per-IP alone is wrong for login.** An attacker rotates IPs; meanwhile a whole
  shop behind one NAT address gets locked out. Limit per account *and* per IP,
  with different thresholds.
- **Per-user alone is wrong for unauthenticated routes** — there is no user yet.
- Behind a proxy, the client IP must come from a trusted `X-Forwarded-For`
  configuration. A misconfigured proxy makes every request appear to share one
  IP, so a global limit locks out all users at once — verify `trust proxy`.
- Limits must be enforced in **shared state** (Redis) when more than one instance
  runs. In-process counters multiply the effective limit by the instance count.

### Resource bounding

Separate from throttling, and more often missing:

- **Pagination caps.** Enforce a server-side maximum; never honour an unbounded
  client `limit`.
  ```js
  const take = Math.min(Number(query.limit) || 25, 100);
  ```
- **Query timeouts** at the database and HTTP layers.
- **Payload size limits** on JSON bodies and uploads.
- **Depth and complexity limits** for GraphQL.
- **Bounded concurrency** for background jobs triggered by requests.

### Behaviour

- Respond `429` with `Retry-After`, and `RateLimit-*` headers so clients can
  behave.
- Do not leak whether an account exists via differing limit behaviour.
- Log limit breaches — a spike is an attack signal and belongs in monitoring.
- Fail closed on limiter outage for authentication endpoints; failing open turns
  a Redis blip into an open brute-force window.

### Detection

```bash
grep -rnE "rateLimit|Throttle|express-rate-limit|express-slow-down|bottleneck" src/ package.json
grep -rnE "(limit|take|pageSize)\s*[:=]\s*(Number|parseInt|req\.query)" src/ --include=*.js
grep -rn "trust proxy\|trustProxy" src/ --include=*.js
```

An authentication endpoint with no limiter is a finding on its own.

### Severity

`HIGH` for missing limits on authentication and password reset. `MEDIUM` for
unbounded pagination and exports, raised to `HIGH` where a single request can
exhaust memory. `MEDIUM` for in-process limiters in a multi-instance deployment.

### Checklist

- [ ] Login, reset, and MFA limited per account and per IP
- [ ] Expensive endpoints (search, export, upload) limited
- [ ] Limiter state shared across instances
- [ ] Proxy trust configured so client IP is accurate
- [ ] Pagination capped server-side
- [ ] Payload size and query timeouts enforced
- [ ] `429` returned with `Retry-After`
- [ ] Breaches logged and alertable
- [ ] Authentication limiter fails closed

## References

- **OWASP API Security Top 10 (2023) — API4 Unrestricted Resource Consumption**
  <https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/>
- **OWASP Denial of Service Cheat Sheet** — resource bounding
  <https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html>
- **OWASP Authentication Cheat Sheet** — lockout and throttling on login
  <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- **CWE-770** (allocation without limits), **CWE-307** (improper restriction of
  authentication attempts) <https://cwe.mitre.org/>
- **RFC 6585 §4 / draft-ietf-httpapi-ratelimit-headers** — `429` and
  `RateLimit-*` headers <https://datatracker.ietf.org/doc/html/rfc6585>

**Not sourced — written for this framework:** the endpoint-class table, the
NAT/shop lockout scoping rationale, the detection commands, and the fail-closed
rule for authentication limiters.
