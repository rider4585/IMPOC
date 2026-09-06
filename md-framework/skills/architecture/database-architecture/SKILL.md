---
name: database-architecture
version: 1.0.0
description: |
  Make structural data decisions — table ownership, tenancy model, transactional
  boundaries, storage choices, read/write separation, and archival. Use when
  deciding where data belongs, choosing a tenancy strategy, considering a cache
  or a second datastore, or when asked "should this be its own database". For
  table-level design see schema-design.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Database Architecture

Structural data decisions — the ones that are expensive or impossible to reverse
once there is production data. Table-level design (columns, types, keys) is
`schema-design`; this is the layer above it.

### One database, until proven otherwise

A single PostgreSQL instance is the right answer for far longer than people
expect. It gives you transactions across all your data, joins, one backup, one
consistency model, and one thing to operate.

**Splitting data across stores costs you transactions.** The moment a sale is in
one database and stock is in another, "decrement stock and record the sale
atomically" becomes a distributed transaction problem with compensating actions
and reconciliation. For a retail system that trade is almost never worth it.

Add a second store only for a specific, stated reason:

| Store | Legitimate reason | Not a reason |
|---|---|---|
| Redis | Session store, rate limiting, cache, job queue | "Postgres is slow" (measure first) |
| Search engine | Genuine full-text needs beyond `tsvector` | Basic product search |
| Object storage | Receipts, exports, images | Anything relational |
| Analytics warehouse | Reporting load harming transactional work | Reports you have not profiled |

PostgreSQL covers JSON, full-text search, queues (`SKIP LOCKED`), and time-series
adequately. Exhaust it before adding an operational dependency.

### Data ownership

Every table has **exactly one writing module** — the same rule as
`module-boundaries`, applied to storage. Record it explicitly:

| Module | Owns (writes) | Reads via contract |
|---|---|---|
| `sales` | `sale`, `sale_line`, `payment` | `product`, `stock` |
| `inventory` | `stock`, `stock_movement` | `product` |
| `products` | `product`, `category` | — |
| `pricing` | `price_period`, `promotion` | `product` |

Shared writers are the root cause of data that does not reconcile.

### Tenancy is a structural decision

For a multi-shop system, decide once — retrofitting is a migration of everything.

| Model | How | Trade-off |
|---|---|---|
| **Shared schema, `shop_id` column** | One set of tables, tenant column everywhere | Simplest to operate; isolation depends on every query being scoped |
| Schema per tenant | One PostgreSQL schema each | Better isolation; migrations multiply |
| Database per tenant | Full separation | Strong isolation; heavy operationally |

Shared schema is right for almost all systems at this scale. **But it makes
isolation a code property**, so make it structural rather than a convention:

1. `shop_id` on every tenant-scoped table, indexed, `NOT NULL`
2. Tenant included in unique constraints — `UNIQUE (shop_id, sku)`, not
   `UNIQUE (sku)`
3. Scoping enforced by a repository layer or **PostgreSQL row-level security**,
   not by remembering
4. Cross-tenant queries only in explicitly audited administrative paths

See `authorization-security`.

### Transactional boundaries

Decide what must be atomic; that decision constrains everything else.

**Must be atomic:** sale + lines + stock movement + payment. Anything else risks
a sale with no stock decrement, or a payment with no sale.

**Can be eventual:** reporting aggregates, search indexes, notifications,
analytics, external syncs.

Anything requiring atomicity must live in one database. That constraint is a
valid architectural argument against splitting, and should be stated as one.

### Derived data

Prefer deriving on read. Store a computed value only when profiling shows the
derivation is too slow, and then:

- Maintain it in the **same transaction** as the source change, or via a trigger
- Provide a **reconciliation query** that recomputes the truth
- Run reconciliation on a schedule with alerting

A stored aggregate with no reconciliation query is a number nobody can defend.
See `data-integrity`.

Materialised views are usually a better first step than hand-maintained columns —
the derivation stays declarative.

### Read/write separation

A read replica helps when reporting load is genuinely harming transactional work,
and only then. The cost is **replication lag**, which is a correctness problem in
retail:

- Never read stock levels from a replica before a sale
- Never read a just-written record from a replica
- Route reporting and analytics to replicas; keep the till on the primary

If a stale read can affect money or stock, it must come from the primary.

### Retention and archival

Retail data grows relentlessly — sales, movements, audit records. Decide early:

- What is retained, and for how long (tax and audit rules often set the floor)
- What is archived versus deleted — **financial records are almost never
  deleted**
- How reporting queries stay fast as history accumulates

Partitioning `sale` and `stock_movement` by date makes archival a `DROP TABLE`
instead of a long `DELETE`. Decide before the table is large — see
`partitioning`.

### Backups are architecture

An untested backup is not a backup. Record: what is backed up, how often, the
recovery point and recovery time objectives, where backups are stored, whether
they are encrypted, and **when a restore was last actually performed**.

For a POS, also state what happens to in-flight sales during a restore.

### Checklist

- [ ] Single database unless a second store is specifically justified
- [ ] PostgreSQL capabilities exhausted before adding a dependency
- [ ] One writing module per table, recorded
- [ ] Tenancy model chosen and documented
- [ ] Tenant column present, indexed, and in unique constraints
- [ ] Tenant scoping enforced structurally, not by convention
- [ ] Atomic boundaries defined for money and stock
- [ ] Eventual consistency used only where staleness is acceptable
- [ ] Derived data maintained transactionally with a reconciliation query
- [ ] Replica reads never used for stock or money decisions
- [ ] Retention and archival policy defined
- [ ] High-growth tables partitioned before they are large
- [ ] Backups defined, encrypted, and restore-tested

## References

- **PostgreSQL 16 documentation — Row Security Policies** — structural tenant
  isolation <https://www.postgresql.org/docs/16/ddl-rowsecurity.html>
- **PostgreSQL 16 documentation — Table Partitioning**
  <https://www.postgresql.org/docs/16/ddl-partitioning.html>
- **PostgreSQL 16 documentation — High Availability, Load Balancing, and
  Replication** — replica lag semantics
  <https://www.postgresql.org/docs/16/high-availability.html>
- **Martin Fowler — Database Thaw / Shared Database integration** — why shared
  writers are an integration anti-pattern
  <https://martinfowler.com/bliki/DatabaseThaw.html>
- **AWS Well-Architected Framework — Reliability Pillar** — RPO/RTO framing for
  backups
  <https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html>

**Not sourced — written for this framework:** the second-store justification
table, the retail ownership table, the tenancy enforcement steps, the
replica-read rules for stock, and the checklist.
