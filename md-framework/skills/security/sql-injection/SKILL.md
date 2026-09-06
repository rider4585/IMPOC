---
name: sql-injection
version: 1.0.0
description: |
  Detect and remediate SQL injection in Node.js/TypeScript applications using
  PostgreSQL, including ORM escape hatches, dynamic identifiers, and unsafe
  ORDER BY construction. Use when reviewing any code that builds a query, when
  asked "check for SQL injection", "is this query safe", or as part of a secure
  code review of data access code. CWE-89.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## SQL Injection (CWE-89)

Untrusted input parsed as SQL rather than data. Still the highest-impact
injection class: it yields the entire database, and in a multi-tenant retail
system that means every shop's sales, costs, and customers.

### The only real defence

**Parameterised queries.** Escaping, quoting, and denylists all fail on some
encoding or dialect. Bind values; never concatenate them.

```js
// ❌ interpolated — injectable
db.query(`SELECT * FROM sales WHERE shop_id = ${shopId} AND note = '${note}'`);

// ✅ parameterised
db.query('SELECT * FROM sales WHERE shop_id = $1 AND note = $2', [shopId, note]);
```

### Detection

```bash
# Template literals reaching query calls
grep -rnE "(query|raw|execute)\(\s*\`" src/ --include=*.js
# String concatenation into SQL
grep -rnE "(SELECT|INSERT|UPDATE|DELETE|WHERE|ORDER BY)[^\"'\`]*(\+|\\\$\{)" src/ --include=*.js -i
# ORM escape hatches — the usual culprits
grep -rnE "sequelize\.query\(|QueryTypes|\.literal\(|\.raw\(" src/ --include=*.js
```

Then **trace each hit**: does user input actually reach it? A template literal
built only from constants is not a finding.

### The three cases parameterisation does not cover

Bind parameters work for *values* only. These need different handling:

1. **Dynamic column or table names** — cannot be bound. Allow-list against a
   fixed set:
   ```js
   const SORTABLE = { name: 'name', price: 'unit_price' } as const;
   const col = SORTABLE[req.query.sort as keyof typeof SORTABLE] ?? 'name';
   ```

2. **`ORDER BY` direction** — allow-list to exactly `ASC` or `DESC`.

3. **`IN` lists** — generate the correct number of placeholders; never join the
   values into the string.
   ```js
   const ph = ids.map((_, i) => `$${i + 1}`).join(',');
   db.query(`SELECT * FROM products WHERE id IN (${ph})`, ids);
   ```

### PostgreSQL-specific notes

- `LIKE`/`ILIKE` patterns: bind the value, and escape `%` and `_` in the input if
  the user should not control matching breadth.
- JSONB path operators accept bound parameters — use them.
- Stored functions are not automatically safe; dynamic SQL inside `PL/pgSQL`
  needs `format()` with `%I`/`%L`, not concatenation.
- A least-privilege database role limits the blast radius of any injection that
  does slip through. The application should not connect as owner or superuser.

### Severity

`CRITICAL` when reachable unauthenticated or when it crosses tenants; `HIGH` when
authenticated. Blind and time-based variants are the same severity as direct —
exploitability is only marginally lower.

### Checklist

- [ ] All query construction sites located, including ORM raw calls
- [ ] Each traced from user input, not just pattern-matched
- [ ] Every value bound, never interpolated
- [ ] Dynamic identifiers allow-listed against a fixed set
- [ ] `ORDER BY` direction constrained to ASC/DESC
- [ ] `IN` lists use generated placeholders
- [ ] Database role is least-privilege
- [ ] Regression test added for any finding

## References

- **OWASP SQL Injection Prevention Cheat Sheet** — parameterisation as primary
  defence, allow-listing for identifiers
  <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html>
- **CWE-89** — weakness definition <https://cwe.mitre.org/data/definitions/89.html>
- **OWASP Top 10 (2021) A03 Injection** <https://owasp.org/Top10/A03_2021-Injection/>
- **PostgreSQL 16 documentation — `format()` and quoting functions** — the
  `%I`/`%L` guidance for PL/pgSQL dynamic SQL
  <https://www.postgresql.org/docs/16/functions-string.html>
- **OWASP Database Security Cheat Sheet** — least-privilege connection role
  <https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html>

**Not sourced — written for this framework:** the Node/TypeScript grep patterns,
the Prisma/Knex/Sequelize escape-hatch names, the placeholder-generation snippet,
and the multi-tenant severity rule.
