---
name: logging
version: 1.0.0
description: |
  Implement structured logging and audit trails — log levels, correlation ids,
  redaction of secrets and PII, and attributable audit records for financial
  operations. Use when adding logging, when an incident could not be diagnosed
  from logs, or when a privileged action needs to be attributable. CWE-532,
  CWE-778.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Logging

Two different things share the word "logging", and conflating them is the usual
mistake:

- **Operational logs** — diagnose failures. Sampled, expiring, best-effort.
- **Audit records** — who did what to money or stock. Complete, durable,
  attributable, and in a retail system frequently a compliance obligation.

Audit records belong in the **database**, in the same transaction as the effect.
A void recorded only in a log file is a void that disappears with log rotation.

### Structured, never interpolated

```js
// ❌ unsearchable, and injectable — see `injection`
logger.info(`Sale ${saleId} voided by ${userId}`);

// ✅ queryable fields; input can never forge a log line
logger.info({ saleId, userId, action: 'sale.void' }, 'sale voided');
```

Structured logging is what makes "show me every void by this user last Tuesday"
answerable. It also neutralises log injection: a newline in a field value is
data, not a new entry.

### Levels — use them consistently

| Level | Use for | Example |
|---|---|---|
| `fatal` | Process cannot continue | Config invalid at startup |
| `error` | Operation failed unexpectedly; needs attention | Unhandled `5xx` |
| `warn` | Expected failure worth noticing | Auth denied, rate limit hit, retry |
| `info` | Significant business events | Sale completed, shift closed |
| `debug` | Diagnostic detail | Query parameters, branch decisions |
| `trace` | Very verbose | Rarely enabled |

A rejected request is `warn`, not `error` — the system worked. Reserve `error`
for things a human should look at, or the level stops meaning anything.

### Correlation ids

Without one, a user's report cannot be tied to a log line.

```js
export function requestId(req, res, next) {
  req.id = req.get('X-Request-Id') ?? crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  req.log = logger.child({ requestId: req.id, userId: req.user?.sub });
  next();
}
```

Register it before the logger and routes (see `express`), use `req.log`
throughout the request, and return the id in error responses (see `rest-api`).

### Redaction is mandatory

Logs leak more credentials than code does — see `secrets-detection`.

```js
const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie',
      'password', '*.password', 'passwordHash', 'token', 'refreshToken',
      'card', 'cardNumber', 'cvv', 'pan',
      'customer.email', 'customer.phone',
    ],
    censor: '[redacted]',
  },
});
```

**Never log whole objects.** `logger.info({ req })` or `logger.info({ user })`
serialises everything, including the fields added next month that nobody thought
about. Log named fields.

Card data — PAN, CVV, track data — must never appear in logs at all. Any
occurrence is `CRITICAL` (PCI DSS Requirement 3) — see `project-pos-rules`.

### What to log

**Always:**
- Authentication outcomes (success and failure), with the account
- Authorisation denials
- Every privileged operation: void, refund, discount override, price change,
  stock adjustment, role change, user creation and disablement
- Unexpected errors, with stack and correlation id
- Startup configuration summary — names only, never values

**Never:** passwords, tokens, card data, full request or config objects, PII
beyond what an incident genuinely needs.

### Audit records

For anything financial, a log line is not enough.

```js
await sequelize.transaction(async (t) => {
  await sale.update({ status: 'void', voidedAt: new Date() }, { transaction: t });

  await AuditLog.create({
    entityType: 'sale',
    entityId:   sale.id,
    action:     'void',
    actorId:    req.user.sub,          // who — never nullable
    shopId:     req.user.shopId,
    reason:     req.validated.reason,  // why — required for overrides
    before:     { status: 'completed' },
    after:      { status: 'void' },
    requestId:  req.id,
  }, { transaction: t });
});
```

Requirements:

- **Same transaction as the effect.** Otherwise the action can succeed while the
  record fails.
- **Append-only.** No updates, no deletes. Enforce with permissions or a trigger.
- **Actor never null.** An unattributable financial action is an internal control
  failure — flag it as a finding, not a nice-to-have.
- **Reason required** for overrides and adjustments.

### Operational concerns

- Log to `stdout` as JSON; let the platform handle shipping and rotation. Writing
  files from the application is a solved problem you do not need to re-solve.
- Sample high-volume `debug` logs; never sample audit records or errors.
- Set retention deliberately — long enough to investigate, short enough to
  respect data minimisation.
- Alert on rates, not lines: a spike in auth failures or `5xx` matters; a single
  line does not.

Logging that nobody monitors is OWASP A09 — the failure is not the absence of
logs but the absence of anyone noticing.

### Detection

```bash
grep -rnE "console\.(log|error|warn)\(" src/ --include=*.js
grep -rnE "logger\.(info|debug|warn|error)\(\s*\`" src/ --include=*.js       # interpolated
grep -rnE "log.*\{\s*(req|user|config|body)\s*\}" src/ --include=*.js        # whole objects
grep -rn "redact" src/ --include=*.js
grep -rniE "(void|refund|override|adjust)" src/services/ --include=*.js | head -20
```

The last command finds privileged operations — cross-check each against the
audit table.

### Checklist

- [ ] Structured JSON logging; no string interpolation
- [ ] Levels used consistently; rejections are `warn`, not `error`
- [ ] Correlation id generated per request and returned in responses
- [ ] Redaction configured for credentials, tokens, card data, and PII
- [ ] No whole request, user, or config objects logged
- [ ] No `console.*` in application code
- [ ] Auth outcomes and authorisation denials logged
- [ ] Every privileged operation writes an audit record
- [ ] Audit records written in the same transaction as the effect
- [ ] Audit table append-only, actor non-null, reason required for overrides
- [ ] Logs to `stdout`; retention set deliberately
- [ ] Alerting on error and auth-failure rates

## References

- **OWASP Logging Cheat Sheet** — what to log, what never to log, format
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- **OWASP Top 10 (2021) A09 Security Logging and Monitoring Failures**
  <https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/>
- **CWE-532** (information exposure through logs), **CWE-778** (insufficient
  logging) <https://cwe.mitre.org/data/definitions/532.html>
- **PCI DSS v4.0, Requirements 3 and 10** — prohibition on storing sensitive
  authentication data; audit trail content
  <https://www.pcisecuritystandards.org/document_library/>
- **Pino documentation — redaction and child loggers**
  <https://getpino.io/#/docs/redaction>
- **Twelve-Factor App — XI. Logs** — treat logs as event streams to `stdout`
  <https://12factor.net/logs>

**Not sourced — written for this framework:** the operational-vs-audit
distinction, the audit record schema and its four requirements, the retail
privileged-operation list, and the detection commands.
