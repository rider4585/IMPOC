---
name: configuration
version: 1.0.0
description: |
  Manage application configuration — environment variables, startup validation,
  secret handling, and environment parity. Use when adding a configuration value,
  when a setting differs between environments, when onboarding needs setup steps,
  or when asked "where should this value live".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Configuration

Configuration is what varies between deployments. Code is what does not. The two
failure modes are equally common: hard-coding something that varies, and
scattering `process.env` reads so the real configuration surface is invisible.

### One validated module, read once at startup

```js
// config/index.js
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV:       z.enum(['development', 'test', 'production']),
  PORT:           z.coerce.number().int().positive().default(3000),
  DATABASE_URL:   z.string().url(),
  ACCESS_SECRET:  z.string().min(32),
  REFRESH_SECRET: z.string().min(32),
  CORS_ORIGINS:   z.string().transform((s) => s.split(',').map((o) => o.trim())),
  LOG_LEVEL:      z.enum(['fatal','error','warn','info','debug','trace']).default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Print the missing NAMES, never the values
  console.error('Invalid configuration:', Object.keys(z.flattenError(parsed.error).fieldErrors));
  process.exit(1);
}

export const config = Object.freeze(parsed.data);
```

What this buys:

- **Fail fast at startup**, not at 2 a.m. when the first request hits the code
  path that needed the variable.
- **The schema is the documentation.** Every setting is visible in one file.
- **Coercion happens once.** `process.env` values are always strings;
  `PORT + 1` silently producing `'30001'` is a real bug class.
- **Minimum lengths on secrets** catch a placeholder promoted to production.

Import `config` everywhere. `process.env` should not appear outside this module.

### Never fall back to a default secret

```js
const secret = process.env.ACCESS_SECRET || 'dev-secret';   // ❌ CRITICAL
```

A fallback secret means production may be running on a value published in the
repository, and nothing will tell you. Required values have no defaults — fail
closed. See `security-misconfiguration`.

Defaults are fine for genuinely optional operational settings (`PORT`,
`LOG_LEVEL`); never for anything security-relevant.

### Secrets never enter the repository

- `.env` in `.gitignore`. Commit `.env.example` with **placeholder** values and
  every key present, so it doubles as the setup checklist.
- Inject real secrets at runtime — platform environment, or a secret manager.
- Rotate on any suspicion of exposure; a leaked secret is compromised from the
  moment it was written. See `secrets-detection`.

```bash
# .env.example — names and shapes only
DATABASE_URL=postgres://user:password@localhost:5432/impoc
ACCESS_SECRET=generate-with-openssl-rand-base64-32
```

### Config is not feature flags

| Kind | Where | Changes |
|---|---|---|
| Deployment config | Environment | Per environment, at deploy |
| Feature flags | Database or flag service | At runtime, without redeploy |
| Business rules | Database | By business users |
| Constants | Code | Never at runtime |

Tax rates, discount limits, and receipt footers are **business data**, not
configuration. Putting them in environment variables means a deploy to change a
tax rate, and no audit trail for a financial parameter. Store them in the
database, with history.

### Environment parity

Keep development, test, and production as similar as possible — the same
PostgreSQL major version, the same Node version, the same migrations. Differences
are where "works on my machine" lives.

Where behaviour must differ, make it explicit and centralised:

```js
export const isProd = config.NODE_ENV === 'production';
```

Never scatter `NODE_ENV` checks through business logic. A code path that only
runs in production is a code path that is never tested.

### Detection

```bash
grep -rn "process.env" src/ --include=*.js | grep -v "config/"     # reads outside config
grep -rnE "process\.env\.[A-Z_]+\s*\|\|" src/ --include=*.js       # fallback defaults
git ls-files | grep -E "^\.env$|\.env\.(local|production)"          # committed secrets
grep -rn "NODE_ENV" src/ --include=*.js | grep -v "config/"
diff <(grep -oE '^[A-Z_]+' .env.example | sort) \
     <(grep -oE '[A-Z_]{3,}' config/index.js | sort -u)             # drift
```

The last one catches `.env.example` drifting behind the schema — the usual cause
of a broken first-run for a new developer.

### Checklist

- [ ] All configuration read and validated in one module at startup
- [ ] Invalid or missing configuration exits the process
- [ ] Error output names the missing keys, never their values
- [ ] Types coerced once in the schema
- [ ] No `process.env` reads outside the config module
- [ ] No fallback defaults for secrets or security settings
- [ ] Minimum lengths enforced on secrets
- [ ] `.env` gitignored; `.env.example` complete with placeholders
- [ ] Business rules in the database, not environment variables
- [ ] `NODE_ENV` branching centralised, not scattered
- [ ] Config object frozen after parsing

## References

- **Twelve-Factor App — III. Config** — strict separation of config from code
  <https://12factor.net/config>
- **Twelve-Factor App — X. Dev/prod parity** <https://12factor.net/dev-prod-parity>
- **OWASP Secrets Management Cheat Sheet** — storage, injection, rotation
  <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>
- **OWASP Top 10 (2021) A05 Security Misconfiguration**
  <https://owasp.org/Top10/A05_2021-Security_Misconfiguration/>
- **Zod documentation** — `coerce`, `safeParse`, error flattening
  <https://zod.dev/>
- **Node.js documentation — `process.env`**
  <https://nodejs.org/api/process.html#processenv>

**Not sourced — written for this framework:** the config-kind table separating
deployment config from feature flags and business rules, the tax-rate example,
the `.env.example` drift check, and the checklist.
