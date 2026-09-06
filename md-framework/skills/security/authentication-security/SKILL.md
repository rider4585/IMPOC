---
name: authentication-security
version: 1.0.0
description: |
  Review credential handling end to end — password storage, login, brute-force
  resistance, MFA, account recovery, and credential change flows. Use when
  reviewing any login, registration, password reset, or user management code, or
  when asked "is our authentication secure". For token and session lifecycle see
  session-security; for API-level auth gaps see broken-authentication.
  CWE-256, CWE-307, CWE-521, CWE-640.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Authentication Security

Authentication establishes identity. Most real compromise of retail systems is
credential-based — stolen, shared, guessed, or reset by an attacker — so the
recovery flow deserves as much scrutiny as the login itself.

### Password storage

```bash
grep -rnE "(createHash|md5|sha1|sha256)\(" src/ --include=*.js
grep -rnE "(bcrypt|argon2|scrypt|pbkdf2)" src/ --include=*.js package.json
```

- Use **argon2id** (preferred) or **bcrypt** with cost ≥ 12. Never a plain hash —
  MD5, SHA-1, and SHA-256 are all findings regardless of salting, because they are
  fast by design.
- Never store, log, or return a password. Check error paths and audit logs too.
- Compare with the library's own verify function; never `===` on a hash.
- Enforce a minimum length (≥ 12) and screen against a breached-password list.
  Do **not** enforce composition rules or forced rotation — current NIST guidance
  is that both reduce real-world strength.

### Login flow

- **Rate limit and lock out.** Per-account and per-IP. Without it, credential
  stuffing succeeds against reused staff passwords.
- **Uniform responses and timing.** "Invalid email or password" for both cases,
  and a constant-time path — an early return on unknown user is a user
  enumeration oracle.
- **Verify before side effects.** No session, no cookie, no logging-in partial
  state until the credential is confirmed.
- **Regenerate the session identifier on login** to prevent fixation.

### Multi-factor

For any role that can move money, change prices, or manage users, MFA should be
available and enforceable. Verify: the second factor is checked server-side, the
first-factor session cannot act before the second completes, and backup codes are
single-use and hashed at rest.

### Account recovery — usually the weakest path

- Reset tokens: cryptographically random (≥ 128 bits), single-use, short-lived
  (≤ 1 hour), hashed at rest, and invalidated on use or on a new request.
- The reset endpoint must respond identically for known and unknown addresses.
- Never email a password. Never include the token in a redirect that reaches
  `Referer`.
- Invalidate all existing sessions on password change or reset.

### Credential change

- Require the current password to change email or password.
- Notify the account holder out of band on any credential change.
- Re-authenticate before high-value operations (role changes, payout details).

### Machine credentials

API keys and service accounts: hashed at rest, scoped to least privilege,
rotatable, and revocable. A shared static key used by every till is a finding —
compromise of one device compromises all.

### Severity

`CRITICAL` for plaintext or fast-hash storage, authentication bypass, and reset
tokens that are guessable or reusable. `HIGH` for missing rate limiting, user
enumeration on reset, and sessions surviving a password change. `MEDIUM` for
missing out-of-band notification.

### Checklist

- [ ] argon2id or bcrypt (cost ≥ 12); no fast hashes anywhere
- [ ] Passwords never logged, returned, or stored in plaintext
- [ ] Rate limiting and lockout on login, per account and per IP
- [ ] Uniform error responses and timing; no enumeration
- [ ] Session id regenerated on login
- [ ] Reset tokens random, single-use, short-lived, hashed
- [ ] All sessions invalidated on credential change
- [ ] Current password required for credential changes
- [ ] MFA available for privileged roles
- [ ] API keys hashed, scoped, rotatable; no shared static keys

## References

- **OWASP Authentication Cheat Sheet** — login flow, enumeration, lockout
  <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- **OWASP Password Storage Cheat Sheet** — argon2id/bcrypt parameters
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- **OWASP Forgot Password Cheat Sheet** — recovery token requirements
  <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
- **NIST SP 800-63B** — minimum length over composition rules; no forced rotation
  <https://pages.nist.gov/800-63-3/sp800-63b.html>
- **OWASP ASVS 4.0, V2 Authentication**
  <https://owasp.org/www-project-application-security-verification-standard/>
- **CWE-256, CWE-307, CWE-521, CWE-640** <https://cwe.mitre.org/>

**Not sourced — written for this framework:** the detection commands, the
per-till shared API key example, and the severity mapping.
