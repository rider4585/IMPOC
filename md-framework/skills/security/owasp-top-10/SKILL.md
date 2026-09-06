---
name: owasp-top-10
version: 1.0.0
description: |
  Review a web application against the OWASP Top 10 (2021) — the ten most
  critical web application security risks — with per-category detection guidance
  for Node.js, TypeScript, PostgreSQL and React. Use as the baseline checklist for
  any web application security assessment, when asked "check OWASP compliance",
  "run a security baseline", or as the standing coverage list for a security
  review gate.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## OWASP Top 10 (2021)

The baseline coverage list. Work through all ten — the value is in the
completeness, not in depth on any one. Depth lives in the dedicated skills, which
are named per category below.

### A01 — Broken Access Control

The most common serious category. Users acting outside intended permissions.

- Verify **object-level** authorisation on every identifier parameter, not just
  route-level role checks.
- Check for forced browsing to admin routes, IDOR, JWT/role tampering, and CORS
  misconfiguration allowing credentialed cross-origin reads.
- Deny by default; enforce server-side only.

→ `authorization-security`, `broken-object-level-authorization`

### A02 — Cryptographic Failures

Data exposed in transit or at rest.

- TLS everywhere; no downgrade paths. HSTS present.
- Passwords hashed with **argon2id** or **bcrypt** (cost ≥ 12) — never MD5/SHA-1,
  never unsalted.
- No hard-coded keys; no ECB mode; random IVs from a CSPRNG.
- Card data: confirm PAN/CVV are never stored or logged.

→ `secrets-detection`

### A03 — Injection

Untrusted data interpreted as a command or query.

```bash
grep -rnE "\\\$\{[^}]*\}" src/ --include=*.js | grep -iE "query|sql|exec"
grep -rnE "(exec|execSync|spawn)\(|new Function\(|\beval\(" src/ --include=*.js
```
- Parameterise every query. The usual defect is an ORM raw-query escape hatch —
  in Sequelize, `sequelize.query()` without `replacements`./;
- Encode output per context; React escapes JSX text but not
  `dangerouslySetInnerHTML` or `href`.

→ `injection`, `sql-injection`, `xss`, `output-encoding`

### A04 — Insecure Design

Missing controls that no amount of correct implementation can supply.

- Was the feature threat-modelled? Are limits designed for abuse cases (refund
  loops, discount stacking, unbounded exports)?
- Segregate tenants by design, not by query discipline.

→ `threat-modeling`, `stride`

### A05 — Security Misconfiguration

- Default credentials, verbose errors, stack traces to clients, directory
  listing, source maps in production, permissive CORS, missing security headers.
- Unnecessary features and ports enabled.

→ `security-misconfiguration`

### A06 — Vulnerable and Outdated Components

- Audit the resolved lockfile, not the manifest. Assess reachability.

→ `dependency-vulnerabilities`, `supply-chain-security`

### A07 — Identification and Authentication Failures

- Credential stuffing and brute force: rate limit and lock out.
- Session fixation, weak session invalidation on logout and password change.
- Weak recovery flows — often the softest path in.

→ `authentication-security`, `session-security`, `broken-authentication`

### A08 — Software and Data Integrity Failures

- Unsigned or unverified updates and plugins.
- **Insecure deserialization** of untrusted data.
- CI/CD pipeline trust: who can inject a build step?

→ `insecure-deserialization`, `supply-chain-security`

### A09 — Security Logging and Monitoring Failures

- Are logins, access-control failures, and high-value actions (void, refund,
  price override, stock adjustment) logged and attributable?
- Are logs free of secrets and card data?
- Is anyone alerted, or is it write-only?

### A10 — Server-Side Request Forgery

- Any server-side fetch of a user-supplied URL: webhooks, image fetch, imports.
- Allow-list destinations; block link-local and private ranges; do not follow
  redirects blindly.

→ `ssrf`

### Output

Report per category: **PASS / FINDING / NOT APPLICABLE**, with findings carrying
severity, location, attack path, and remediation. `NOT APPLICABLE` requires a
reason — an unexamined category is not "not applicable".

## References

- **OWASP Top 10 (2021)** — category definitions and ordering
  <https://owasp.org/Top10/>
- **OWASP Cheat Sheet Series** — per-category remediation guidance
  <https://cheatsheetseries.owasp.org/>
- **OWASP ASVS 4.0** — verification requirements behind each category
  <https://owasp.org/www-project-application-security-verification-standard/>
- **OWASP Password Storage Cheat Sheet** — the argon2id/bcrypt guidance in A02
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>

**Not sourced — written for this framework:** the Node/TypeScript detection
commands, the React-specific notes in A03, and the retail examples (refund loops,
discount stacking, void/price-override logging) in A04 and A09.
