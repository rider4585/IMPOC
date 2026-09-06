---
name: security-architecture
version: 1.0.0
description: |
  Place security controls structurally — trust zones, defence in depth, where
  authorisation and validation belong, secret and key management, and designing
  for auditability. Use when designing a feature that touches money, identity, or
  personal data, or when asked "where should this control live". For finding
  flaws in existing code see the security review skills.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Security Architecture

Design-time security: putting controls where they cannot be bypassed or
forgotten. A control that depends on every future developer remembering it is not
an architecture, it is a hope.

**The governing question:** *if the next person writes this feature carelessly,
what still protects the system?*

### Trust zones

Map them before deciding anything. Controls belong at the boundaries — see
`trust-boundaries`.

| Zone | Trust | What it means |
|---|---|---|
| Browser / till client | **None** | Everything from here is attacker-controlled |
| API surface | Boundary | Validate, authenticate, authorise here |
| Service layer | Trusted, if inputs were checked | Business invariants enforced |
| Database | Trusted store | Last line: constraints |
| Third-party APIs | **None** | Responses validated like user input |

The client is untrusted even though you wrote it. Prices, roles, tenant ids, and
totals coming from a browser are attacker input, regardless of what your UI does.

### Make controls structural

Ranked by how hard they are to bypass or forget:

| Placement | Strength | Example |
|---|---|---|
| Database constraint | Strongest — survives all application bugs | `CHECK (quantity >= 0)` |
| Row-level security | Survives a forgotten `WHERE` | Tenant isolation |
| Repository layer | Cannot be forgotten per call site | Auto-injected `shop_id` |
| Router middleware | Applies to everything below | `requireAuth` on the router |
| Per-handler check | Relies on discipline | `if (sale.shopId !== user.shopId)` |
| Client-side check | **Not a control** | Hiding a button |

Prefer the top of this list. A `CHECK (quantity >= 0)` prevents negative stock
even when a new code path forgets the guard — that is architecture. An `if` in
one service is a convention.

The same logic drives router-level auth: a new route added under a guarded router
is protected **by default**, whereas per-route guards fail by omission.

### Defence in depth

No single control is sufficient, because each has a bypass:

```
Client validation      → UX only; bypassed by any direct call
API schema validation  → shape only; says nothing about entitlement
Authorisation check    → entitlement; says nothing about value ranges
Service invariants     → business rules
Database constraints   → the floor that always holds
```

Each layer catches what the one before it misses. Stock quantity, for example, is
validated at the boundary (positive integer), authorised (may this user adjust
stock), enforced atomically in the update (`WHERE quantity >= $1`), and
constrained in the schema (`CHECK (quantity >= 0)`).

### Design for least privilege

- **Application database role** is not owner and not superuser. It cannot `DROP`
  or `ALTER`. Migrations run as a separate, privileged role.
- **Roles map to permissions**, and permissions live in one place — see
  `authorization`.
- **Service credentials** are scoped, rotatable, and distinct per integration. A
  single shared key used by every till means one compromised device compromises
  all.

### Secrets and keys

- Never in the repository. Injected at runtime — see `configuration` and
  `secrets-detection`.
- Required secrets have **no fallback default**. Missing configuration must stop
  startup, not silently disable a control.
- Distinct secrets per environment; rotation must be possible without a code
  change.
- Anything reaching the browser bundle is public — see `vite`.

### Design for auditability

Auditability is a structural property. Decide at design time, because retrofitting
attribution to an existing flow is expensive.

For every operation that moves money or stock, or changes access:

1. The **actor** is known and recorded — never nullable
2. A **reason** is required for overrides and adjustments
3. The audit record is written in the **same transaction** as the effect
4. The audit store is **append-only**

An operation that cannot be attributed to a person is an internal control
failure, not a missing feature. See `logging`.

Related: financial history should be **append-only** by design. Corrections are
new rows — a refund, a reversal — never an `UPDATE` of the original.

### Fail closed

Every control decides what happens when it cannot function:

| Situation | Correct behaviour |
|---|---|
| Auth service unreachable | Deny |
| Rate limiter store down | Deny on auth endpoints |
| Config value missing | Refuse to start |
| Permission unknown | Deny |
| Tenant scope not resolvable | Deny |

Failing open converts a dependency blip into an open door.

### Minimise what you hold

The safest data is data you never stored.

- **Never store card data** — PAN, CVV, track data. Use a payment provider's
  tokenisation. This is PCI DSS Requirement 3 and it is absolute.
- Collect the minimum customer PII the business actually needs.
- Define retention; delete what is past it, except where law requires keeping it.
- Understand that logs, backups, and exports are copies with the same
  obligations — see `excessive-data-exposure`.

### Checklist

- [ ] Trust zones mapped; controls placed at boundaries
- [ ] Client treated as untrusted, including your own UI
- [ ] Controls placed as high in the structural-strength table as practical
- [ ] Tenant isolation enforced structurally, not per query
- [ ] Auth applied at router level
- [ ] Layered defences for money and stock invariants
- [ ] Application database role is least-privilege
- [ ] Permissions defined in one place
- [ ] Secrets injected, never defaulted, rotatable, per environment
- [ ] Nothing secret in the client bundle
- [ ] Every money/stock/access operation attributable, with reason where relevant
- [ ] Audit records transactional and append-only
- [ ] Financial history append-only
- [ ] Every control fails closed
- [ ] No card data stored; PII minimised with a retention policy

## References

- **OWASP ASVS 4.0** — architectural verification requirements, V1 and V4
  <https://owasp.org/www-project-application-security-verification-standard/>
- **OWASP Top 10 (2021) A04 Insecure Design** — why controls must be designed,
  not added <https://owasp.org/Top10/A04_2021-Insecure_Design/>
- **NIST SP 800-53 / Saltzer and Schroeder** — least privilege, fail-safe
  defaults, economy of mechanism
- **PCI DSS v4.0, Requirements 3, 7, 10** — storage prohibition, least privilege,
  audit trails <https://www.pcisecuritystandards.org/document_library/>
- **PostgreSQL 16 documentation — Row Security Policies**
  <https://www.postgresql.org/docs/16/ddl-rowsecurity.html>

**Not sourced — written for this framework:** the structural-strength ranking
table, the trust-zone table, the four auditability requirements, the fail-closed
table, and the layered stock-quantity example.
