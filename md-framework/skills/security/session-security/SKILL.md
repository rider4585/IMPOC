---
name: session-security
version: 1.0.0
description: |
  Review session lifecycle and cookie configuration — creation, fixation,
  timeout, invalidation, and the flags that protect the session token. Use when
  reviewing login/logout code, session middleware, or cookie configuration, or
  when asked "are our sessions secure". CWE-384, CWE-613, CWE-614.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Session Security

A session token is a bearer credential: whoever holds it is the user. Protect it
in transit, in storage, and across its lifecycle.

Shared-terminal environments raise the stakes. A till used by several staff on
one device makes idle timeout and explicit logout genuine controls, not
formalities — an unattended session is another cashier's session.

### Cookie configuration

```bash
grep -rnE "cookie\(|res\.cookie|session\(\{|SameSite|httpOnly|secure:" src/ --include=*.js
```

| Attribute | Required value | Why |
|---|---|---|
| `HttpOnly` | `true` | JavaScript cannot read it; contains XSS impact |
| `Secure` | `true` | Never sent over plaintext HTTP |
| `SameSite` | `Lax` or `Strict` | Primary CSRF defence |
| `Path` | `/` (or narrower) | Limits exposure |
| `Domain` | Unset unless needed | Setting it widens to subdomains |
| Name prefix | `__Host-` where possible | Browser-enforced Secure + Path + no Domain |
| `Max-Age` / `Expires` | Bounded | No indefinite sessions |

Storing a session token in `localStorage` is a finding — it is readable by any
script and cannot be `HttpOnly`.

### Lifecycle

1. **Creation.** Identifier must be ≥ 128 bits from a CSPRNG. Never derive it
   from user data, a counter, or a timestamp.
2. **Fixation.** Regenerate the session identifier on every privilege change —
   login, MFA completion, role change. Accepting a pre-login identifier after
   authentication is CWE-384.
   ```js
   req.session.regenerate(() => { req.session.userId = user.id; });
   ```
3. **Idle timeout.** Expire after inactivity. For a shared till, short — 15
   minutes or less. Enforce server-side; a client-side timer is cosmetic.
4. **Absolute timeout.** A ceiling regardless of activity, so a stolen token
   cannot be renewed indefinitely.
5. **Invalidation.** Logout must destroy server-side state, not merely clear the
   cookie. Verify the old token is rejected afterwards.
6. **Global invalidation.** Password change, reset, role change, and account
   disablement must terminate all sessions for that user.

### Storage and scope

- Server-side session store (Redis, database) for anything that must be
  revocable. Verify the store is not world-readable and that entries expire.
- Bind the session loosely to context — a sudden IP or user-agent change is worth
  logging, though strict binding breaks legitimate mobile use.
- Never place the session identifier in a URL.

### Concurrency

Decide and enforce a policy on simultaneous sessions per user. For staff
accounts, allowing unlimited concurrent sessions makes credential sharing
invisible — which defeats the audit trail that voids and refunds depend on.

### Severity

`CRITICAL` for session fixation and for tokens accepted after logout.
`HIGH` for a missing `HttpOnly`/`Secure` flag, no absolute timeout, and sessions
surviving a password change. `MEDIUM` for missing idle timeout on a shared
terminal, raised to `HIGH` if the terminal can complete sales.

### Checklist

- [ ] Session id ≥ 128 bits from a CSPRNG
- [ ] Regenerated on login and every privilege change
- [ ] `HttpOnly`, `Secure`, `SameSite` set; `__Host-` prefix where possible
- [ ] Not stored in `localStorage`; never in a URL
- [ ] Idle and absolute timeouts enforced server-side
- [ ] Logout destroys server-side state; old token rejected
- [ ] Credential change invalidates all sessions
- [ ] Concurrent session policy decided and enforced
- [ ] Session store access-controlled with expiry

## References

- **OWASP Session Management Cheat Sheet** — identifier entropy, lifecycle,
  cookie attributes
  <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- **OWASP ASVS 4.0, V3 Session Management**
  <https://owasp.org/www-project-application-security-verification-standard/>
- **RFC 6265bis — Cookies: HTTP State Management** — `SameSite` and the
  `__Host-` prefix <https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis>
- **CWE-384** (fixation), **CWE-613** (insufficient expiration), **CWE-614**
  (Secure flag) <https://cwe.mitre.org/>

**Not sourced — written for this framework:** the shared-till threat framing,
the concurrency/credential-sharing rationale, and the severity mapping.
