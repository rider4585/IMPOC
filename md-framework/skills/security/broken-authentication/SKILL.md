---
name: broken-authentication
version: 1.0.0
description: |
  Find endpoints and token mechanisms where authentication is missing, bypassable,
  or incorrectly verified — unguarded routes, JWT verification flaws, and tokens
  that outlive their authority. Use when reviewing an API's authentication layer,
  when asked "can this be bypassed", or as part of an API security review.
  OWASP API2:2023, CWE-287, CWE-345.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Broken Authentication (API2:2023 / CWE-287)

Distinct from credential handling: this is about endpoints that should require
authentication and don't, and tokens that are accepted when they should not be.

### Unguarded endpoints

The most common instance is simply a route that nobody protected — usually one
added late, or an internal utility that became reachable.

```bash
# Routes with no guard/decorator nearby
grep -rnE "@(Get|Post|Put|Patch|Delete)\(" src/ -A 3 --include=*.js | grep -B 3 -v "UseGuards\|Roles\|Auth"
# Explicit opt-outs — verify every one is intentional
grep -rnE "@(Public|SkipAuth|AllowAnonymous)|authRequired:\s*false" src/ --include=*.js
```

Every `@Public()` needs a justification. These accumulate during development and
are rarely revisited.

### JWT verification flaws

```bash
grep -rnE "jwt\.(decode|verify)\(|jsonwebtoken|jose" src/ --include=*.js
```

| Flaw | Check |
|---|---|
| `decode()` used instead of `verify()` | `decode` performs **no** signature check — always a finding |
| `algorithms` not pinned | Permits `alg: none` or HS/RS confusion; pin explicitly |
| Symmetric key confusion | A public RSA key accepted as an HMAC secret |
| No `exp` verification | Tokens valid forever |
| `iss` / `aud` unchecked | Token from another service or tenant accepted |
| Weak HMAC secret | Brute-forceable; require ≥ 256 bits from a CSPRNG |
| Secret in source | See `secrets-detection` — `CRITICAL` |

```js
// ✅ pin the algorithm and validate claims
jwt.verify(token, key, { algorithms: ['RS256'], issuer: ISS, audience: AUD });
```

### Tokens that outlive their authority

A token is a snapshot of authority at issuance. Verify what happens when
authority changes:

- Role downgraded or account disabled → is the token still accepted?
- Password changed or reset → are prior tokens invalidated?
- Staff member leaves → is there a revocation path at all?

Stateless JWTs cannot be revoked by design. Either keep access-token lifetimes
short (≤ 15 minutes) with refresh-token rotation, or maintain a revocation list.
"We use JWTs so we can't revoke" is a finding, not an explanation.

### Refresh token handling

- Rotate on every use; detect reuse of a consumed refresh token and revoke the
  whole family — that pattern indicates theft.
- Store in an `HttpOnly`, `Secure`, `SameSite` cookie, never in `localStorage`.
- Bind to a device or session where practical.

### Transport and placement

- Tokens never in URLs or query strings — they land in logs, history, and
  `Referer`.
- HTTPS only; `Secure` on every auth cookie.
- No credentials in `GET` parameters.

### Severity

`CRITICAL` for authentication bypass, `decode()` in place of `verify()`,
unpinned algorithms, and unauthenticated access to money or stock operations.
`HIGH` for missing expiry, absent revocation, and tokens in URLs.

### Checklist

- [ ] Every route's authentication requirement confirmed from source
- [ ] Every auth opt-out justified
- [ ] `verify()` used, never `decode()`, for trust decisions
- [ ] Algorithms pinned; `exp`, `iss`, `aud` validated
- [ ] Signing secret ≥ 256 bits, from config, not source
- [ ] Access tokens short-lived; refresh rotation with reuse detection
- [ ] Revocation path exists for disablement and role change
- [ ] Tokens in `HttpOnly`/`Secure` cookies, never URLs or `localStorage`
- [ ] Negative test: request without a token is rejected

## References

- **OWASP API Security Top 10 (2023) — API2 Broken Authentication**
  <https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/>
- **OWASP JSON Web Token for Java / JWT Cheat Sheet** — algorithm pinning, claim
  validation, storage
  <https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html>
- **RFC 8725 — JSON Web Token Best Current Practices** — `alg` confusion and
  verification requirements <https://datatracker.ietf.org/doc/html/rfc8725>
- **RFC 6749 / OAuth 2.0 Security BCP** — refresh token rotation and reuse
  detection <https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics>
- **CWE-287** (improper authentication), **CWE-345** (insufficient verification
  of data authenticity) <https://cwe.mitre.org/>

**Not sourced — written for this framework:** the detection commands, the
Express 5 middleware naming, and the "we use JWTs so we can't revoke" rule.
