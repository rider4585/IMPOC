---
name: security-misconfiguration
version: 1.0.0
description: |
  Review deployment and framework configuration for insecure defaults — missing
  security headers, permissive CORS, verbose errors, exposed source maps, debug
  flags, and unnecessary surfaces. Use when reviewing configuration, deployment
  setup, or middleware, or when asked "check our security configuration".
  OWASP A05:2021 / API8:2023, CWE-16.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Security Misconfiguration (A05:2021 / CWE-16)

Vulnerabilities created by how the system is configured rather than how it is
coded. Common because defaults favour developer convenience and nobody revisits
them before launch.

### Security headers

```bash
grep -rnE "helmet|Content-Security-Policy|Strict-Transport-Security|X-Frame-Options" src/ --include=*.js
```

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | Strict, nonce or hash based, no `unsafe-inline` | Highest-value XSS mitigation |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS |
| `X-Content-Type-Options` | `nosniff` | Stops MIME confusion |
| `X-Frame-Options` / CSP `frame-ancestors` | `DENY` unless embedding is needed | Clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Stops URL leakage |
| `Permissions-Policy` | Deny unused features | Reduces surface |

`helmet()` with defaults covers most of these but **not** a useful CSP — verify
the policy is actually configured rather than assuming the library handled it.

### CORS

```bash
grep -rnE "cors\(|Access-Control-Allow-(Origin|Credentials|Methods)" src/ --include=*.js
```

- `origin: true` or `'*'` **with** `credentials: true` is `CRITICAL` — it lets any
  site make credentialed requests and read responses.
- Allow-list explicit origins. Never reflect the `Origin` header unchecked.
- Restrict methods and headers to what is used.

### Error handling and information disclosure

- No stack traces to clients in production. Return a generic message and a
  correlation id; log the detail server-side.
- Database errors must not surface — they leak schema and sometimes connection
  strings.
- Remove `X-Powered-By` and version banners.

```bash
grep -rnE "NODE_ENV|process\.env\.NODE_ENV" src/ --include=*.js
grep -rnE "stack|err\.stack" src/ --include=*.js | grep -i "res\.\|json\|send"
```

### Build and deployment

- **Source maps** must not be served in production — they publish your original
  source. Check the build config.
- **Debug flags, seed endpoints, and test routes** disabled in production.
- **Directory listing** off; no `.git`, `.env`, or backup files served.
- **Dependencies**: production install excludes dev dependencies.
- **Default credentials** changed — database, admin user, message broker, cache.

```bash
grep -rnE "sourcemap|devtool" vite.config.* webpack.config.* 2>/dev/null
grep -rnE "(seed|debug|test)[-_]?(route|endpoint|mode)" src/ --include=*.js
```

### Database and infrastructure

- Application connects as a least-privilege role, never owner or superuser.
- Database not reachable from the public internet.
- TLS enforced on database and cache connections.
- Backups exist, are restorable, and are encrypted.

### Secure defaults principle

Configuration should fail closed. A missing environment variable should stop
startup, not silently disable a control:

```js
const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error('SESSION_SECRET is required');   // ✅ fail closed
```

A default fallback secret in code is `CRITICAL` — it means production may be
running on a value published in the repository.

### Severity

`CRITICAL` for reflective CORS with credentials and for fallback secrets in code.
`HIGH` for missing HSTS on an authenticated application, stack traces in
production, exposed source maps, and default credentials. `MEDIUM` for missing
hardening headers.

### Checklist

- [ ] Security headers present; CSP actually configured
- [ ] CORS allow-lists explicit origins; no reflection with credentials
- [ ] No stack traces or database errors reach clients
- [ ] Source maps not served in production
- [ ] Debug, seed, and test endpoints disabled
- [ ] No default credentials anywhere
- [ ] Database role least-privilege; not publicly reachable; TLS enforced
- [ ] Missing required configuration fails startup
- [ ] No fallback secrets in code

## References

- **OWASP Top 10 (2021) A05 Security Misconfiguration**
  <https://owasp.org/Top10/A05_2021-Security_Misconfiguration/>
- **OWASP API Security Top 10 (2023) API8 Security Misconfiguration**
  <https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/>
- **OWASP Secure Headers Project** — header set and recommended values
  <https://owasp.org/www-project-secure-headers/>
- **MDN — HTTP headers reference** <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers>
- **CWE-16** <https://cwe.mitre.org/data/definitions/16.html>
- **Helmet documentation** — what the defaults do and do not cover
  <https://helmetjs.github.io/>

**Not sourced — written for this framework:** the detection commands, the
Vite/Webpack source-map checks, and the fail-closed configuration rule.
