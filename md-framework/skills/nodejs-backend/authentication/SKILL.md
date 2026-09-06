---
name: authentication
version: 1.0.0
description: |
  Implement authentication in an Express application — password hashing with
  argon2, JWT issuance and verification, refresh token rotation, cookie
  configuration, and logout. Use when building login, registration, password
  reset, or token handling. This is the build skill; for reviewing existing auth
  for flaws see authentication-security and broken-authentication.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Authentication (implementation)

How to build it. The review counterparts — `authentication-security` (credential
handling flaws) and `broken-authentication` (token and endpoint flaws) — define
what "correct" is checked against; read them before shipping.

### Password hashing — argon2

```js
import argon2 from 'argon2';

// Registration / password change
const hash = await argon2.hash(password, { type: argon2.argon2id });

// Login — always use the library's verify, never string comparison
const ok = await argon2.verify(user.passwordHash, password);
```

`argon2.hash` embeds the salt and parameters in the output string, so there is no
separate salt column and no parameters to store. `verify` reads them back, which
means raising the cost later does not invalidate existing hashes.

Rules:
- Never log, return, or store the plaintext password — check error paths too.
- Never compare hashes with `===`.
- Hash on registration, change, **and reset**. All three paths.

### Login

```js
export async function login(req, res) {
  const { email, password } = req.validated;

  const user = await User.scope('withSecrets').findOne({ where: { email } });

  // Verify even when the user is absent, so timing does not reveal existence
  const ok = user
    ? await argon2.verify(user.passwordHash, password)
    : await argon2.verify(DUMMY_HASH, password).catch(() => false);

  if (!ok || !user || !user.isActive) {
    return res.status(401).json({ title: 'Invalid email or password', status: 401 });
  }

  const { accessToken, refreshToken } = await issueTokens(user);
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ user: toUserResponse(user) });
}
```

Three things doing real work here:

- **Identical response for unknown user and wrong password**, and a dummy verify
  so the timing matches. Either alone leaks whether an account exists.
- **`withSecrets` scope** — the password hash is excluded by the model's
  `defaultScope` and only loaded where genuinely needed (see `sequelize`).
- **Rate limiting** must sit on this route, per account *and* per IP — see
  `rate-limiting`.

### Tokens

```js
const accessToken = jwt.sign(
  { sub: user.id, shopId: user.shopId, role: user.role },
  ACCESS_SECRET,
  { expiresIn: '15m', issuer: ISS, audience: AUD }
);
```

```js
export function requireAuth(req, res, next) {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ title: 'Authentication required', status: 401 });

  try {
    // verify(), never decode() — decode does not check the signature
    req.user = jwt.verify(token, ACCESS_SECRET, {
      algorithms: ['HS256'],          // pin explicitly; prevents alg confusion
      issuer: ISS, audience: AUD,
    });
    next();
  } catch {
    res.status(401).json({ title: 'Session expired', status: 401 });
  }
}
```

Non-negotiable: `verify` not `decode`, algorithms pinned, `issuer`/`audience`
validated, secret from validated config and at least 256 bits.

**Put only what authorisation needs in the payload** — a subject, tenant, and
role. Never a password hash, never PII. The payload is base64, not encrypted;
anyone holding the token can read it.

### Cookies over localStorage

```js
const base = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
res.cookie('access_token',  accessToken,  { ...base, maxAge: 15 * 60 * 1000 });
res.cookie('refresh_token', refreshToken, { ...base, maxAge: 7 * 24 * 3600 * 1000,
                                            path: '/api/v1/auth/refresh' });
```

`httpOnly` means a successful XSS cannot read the token — the main reason not to
use `localStorage`. Scope the refresh cookie to the refresh route so it is not
sent with every request. Cookies mean CSRF applies: see `csrf`.

### Refresh rotation with reuse detection

Short access tokens are only safe if refresh is handled properly.

```js
export async function refresh(req, res) {
  const presented = req.cookies.refresh_token;
  const stored = await RefreshToken.findOne({ where: { tokenHash: sha256(presented) } });

  if (!stored || stored.expiresAt < new Date()) return res.sendStatus(401);

  if (stored.usedAt) {
    // Already consumed → the token leaked. Revoke the whole family.
    await RefreshToken.update({ revokedAt: new Date() }, { where: { familyId: stored.familyId } });
    req.log.warn({ userId: stored.userId }, 'refresh token reuse detected');
    return res.sendStatus(401);
  }

  await stored.update({ usedAt: new Date() });
  const tokens = await issueTokens(await User.findByPk(stored.userId), stored.familyId);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.sendStatus(204);
}
```

Refresh tokens are **hashed at rest** — they are credentials. Reuse of a consumed
token means theft; revoking the family is what limits the damage.

### Revocation

A stateless JWT cannot be revoked, so a role change or a departing staff member
would otherwise remain valid until expiry. Either keep access tokens short (≤ 15
minutes) and revoke at refresh, or check a `tokenVersion` claim against the user
record. Pick one deliberately and write it down.

### Logout

```js
await RefreshToken.update({ revokedAt: new Date() }, { where: { familyId } });
res.clearCookie('access_token',  { path: '/' });
res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
```

Clearing cookies alone is not logout — the refresh token stays valid server-side.
Revoke, then clear.

### Password reset

Random token (≥ 128 bits), **hashed at rest**, single-use, ≤ 1 hour. Identical
response for known and unknown addresses. On success: revoke every session and
refresh family for that user. See `authentication-security`.

### Detection

```bash
grep -rnE "jwt\.decode\(" src/ --include=*.js                       # must be verify()
grep -rn "jwt.verify" src/ -A 3 --include=*.js | grep -v algorithms  # unpinned alg
grep -rnE "createHash\(['\"](md5|sha1)" src/ --include=*.js
grep -rn "localStorage" src/ --include=*.jsx | grep -i "token"
grep -rn "passwordHash\|password" src/ --include=*.js | grep -iE "log|console|res\.json"
```

### Checklist

- [ ] argon2id for password hashing; library `verify`, never `===`
- [ ] Passwords never logged, returned, or stored in plaintext
- [ ] Hash on registration, change, and reset
- [ ] Login response and timing identical for unknown user and wrong password
- [ ] Password hash excluded by default scope
- [ ] Rate limiting on login and reset, per account and per IP
- [ ] `jwt.verify` with pinned algorithms, `issuer`, `audience`
- [ ] Secrets from validated config, ≥ 256 bits, never in source
- [ ] Token payload carries no secrets or PII
- [ ] Tokens in `httpOnly`/`secure`/`sameSite` cookies, not `localStorage`
- [ ] Refresh tokens hashed at rest, rotated, with reuse detection
- [ ] A revocation path exists for role change and disablement
- [ ] Logout revokes server-side, then clears cookies
- [ ] Reset tokens random, hashed, single-use, short-lived
- [ ] Credential change invalidates all sessions

## References

- **OWASP Authentication Cheat Sheet** — login flow, enumeration, lockout
  <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- **OWASP Password Storage Cheat Sheet** — argon2id selection and parameters
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- **RFC 8725 — JWT Best Current Practices** — algorithm pinning, claim validation
  <https://datatracker.ietf.org/doc/html/rfc8725>
- **OAuth 2.0 Security Best Current Practice** — refresh rotation and reuse
  detection <https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics>
- **node-argon2 documentation** — `hash`/`verify` API and embedded parameters
  <https://github.com/ranisalt/node-argon2>
- **RFC 6265bis** — cookie attributes
  <https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis>

**Not sourced — written for this framework:** the worked Express/Sequelize
implementations, the dummy-verify timing defence, the refresh-family revocation
pattern, and the detection commands.
