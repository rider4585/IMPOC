---
name: csrf
version: 1.0.0
description: |
  Detect and remediate cross-site request forgery — state-changing requests
  triggered from another origin using the victim's ambient credentials. Use when
  reviewing cookie-authenticated state-changing endpoints, form handling, or CORS
  configuration, or when asked "are we protected against CSRF". CWE-352.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Cross-Site Request Forgery (CWE-352)

An attacker's page causes the victim's browser to send a state-changing request
to your application. The browser attaches the session cookie automatically, so
the request is authenticated — the attacker never needs to read the response.

### Are you exposed?

CSRF requires **ambient credentials**. Work through this before anything else:

| Authentication | Exposed? |
|---|---|
| Session cookie | **Yes** — protection required |
| Token in `Authorization` header | No — headers are not attached automatically |
| Cookie *plus* header token | Only if the cookie alone is sufficient |

An API authenticated purely by `Authorization: Bearer` does not need CSRF tokens.
An application that accepts *either* a cookie or a header does — the cookie path
is the exposure.

### Defences, in order

1. **`SameSite` cookies.** `Lax` blocks cross-site POST; `Strict` blocks
   cross-site navigation too. This is the baseline and covers most cases. Note
   `Lax` still permits top-level `GET`, so it does not save a `GET` that changes
   state.

2. **Anti-CSRF tokens** for anything sensitive. Synchronizer token (server-side,
   per-session) or double-submit cookie. Requirements: unpredictable, bound to the
   session, verified on every state-changing request, and **compared in constant
   time**.

3. **Origin verification.** Check `Origin`, falling back to `Referer`. Reject
   when absent on a state-changing request rather than allowing it through.

4. **Re-authentication** for high-value actions — refunds, payouts, role changes,
   bulk price updates. Defence in depth against a token that leaked via XSS.

### The rule that prevents most CSRF

**`GET` must never change state.** A `GET` that voids a sale, adjusts stock, or
deletes a record is exploitable with a bare `<img>` tag and defeats `SameSite=Lax`.

```bash
grep -rnE "\.get\(" src/ -A 6 --include=*.js | grep -iE "delete|update|create|void|refund|adjust|save"
```

### CORS interaction — commonly confused

CORS does not prevent CSRF. A cross-origin `POST` is *sent* regardless; CORS only
governs whether the attacker can read the response. Worse, a permissive CORS
policy actively enables attacks:

```bash
grep -rnE "cors\(|Access-Control-Allow-(Origin|Credentials)" src/ --include=*.js
```

`origin: true` (reflect any origin) combined with `credentials: true` is a
`CRITICAL` finding — it authorises any site to make credentialed requests and
read the results. Allow-list explicit origins.

### Detection

```bash
grep -rnE "csurf|csrf|xsrf" src/ package.json --include=*.js
grep -rnE "sameSite" src/ --include=*.js
```

Absence of any CSRF middleware in a cookie-authenticated application is itself
the finding.

### Severity

`CRITICAL` for reflective CORS with credentials, and for CSRF reaching money
movement or role changes. `HIGH` for state-changing endpoints with neither
`SameSite` nor tokens. `MEDIUM` where `SameSite=Lax` is present but tokens are
absent on sensitive operations.

### Checklist

- [ ] Ambient-credential exposure determined before assessing
- [ ] `SameSite` set on session cookies
- [ ] Anti-CSRF tokens on sensitive state changes, compared in constant time
- [ ] Tokens bound to the session, not global
- [ ] `Origin`/`Referer` checked; absent header rejected
- [ ] No `GET` endpoint changes state
- [ ] CORS allow-lists explicit origins; no reflection with credentials
- [ ] Re-authentication on high-value actions

## References

- **OWASP Cross-Site Request Forgery Prevention Cheat Sheet** — token patterns,
  `SameSite`, origin verification
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>
- **CWE-352** <https://cwe.mitre.org/data/definitions/352.html>
- **RFC 6265bis** — `SameSite` semantics
  <https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis>
- **MDN — CORS** — why CORS is not a CSRF defence
  <https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS>

**Not sourced — written for this framework:** the exposure-determination table,
the detection commands, and the retail high-value action list (refunds, payouts,
bulk price updates).
