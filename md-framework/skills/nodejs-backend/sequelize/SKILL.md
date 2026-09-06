---
name: sequelize
version: 1.0.0
description: |
  Use Sequelize correctly and safely — model and association definition,
  migrations over sync, safe raw queries with replacements, scopes for tenant
  isolation, eager loading to avoid N+1, and transactions with row locking. Use
  when writing or reviewing any data access code, defining models, or when asked
  "how do I query this".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Sequelize

An ORM is a convenience over SQL, not a replacement for understanding it. The
defects that matter here are the ones where Sequelize's convenience hides a SQL
problem: injection through raw queries, N+1 from lazy associations, and
over-fetching from unscoped finds.

> Documents **Sequelize 6**. The principles hold for v7; the API for defining
> models differs.

### Migrations, never `sync()`

```js
await sequelize.sync({ alter: true });   // ❌ never against a real database
```

`sync` infers DDL from models and will silently drop or rewrite columns. Use
`sequelize-cli` migrations so every schema change is explicit, reviewed, ordered,
and reversible — see `migrations` for the safety rules.

`sync()` is acceptable only in a disposable test database.

### Raw queries — the injection footgun

Sequelize's query builder parameterises for you. The moment you drop to raw SQL,
that stops.

```js
// ❌ interpolated — injectable
await sequelize.query(`SELECT * FROM sale WHERE shop_id = ${shopId}`);

// ✅ bind parameters
await sequelize.query(
  'SELECT * FROM sale WHERE shop_id = :shopId AND sold_at >= :from',
  { replacements: { shopId, from }, type: QueryTypes.SELECT }
);
```

`replacements` escapes values; **`bind` is stronger** — it sends them as real
query parameters:

```js
await sequelize.query('SELECT * FROM sale WHERE shop_id = $1',
  { bind: [shopId], type: QueryTypes.SELECT });
```

`sequelize.literal()` and `Sequelize.fn()` with interpolated input are equally
dangerous — anything inside `literal()` is raw SQL. Identifiers (column names,
sort direction) cannot be bound; allow-list them. See `sql-injection`.

### Models and associations

```js
Sale.init({
  id:      { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  shopId:  { type: DataTypes.BIGINT, allowNull: false, field: 'shop_id' },
  total:   { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status:  { type: DataTypes.STRING, allowNull: false, defaultValue: 'open' },
}, { sequelize, modelName: 'Sale', tableName: 'sale', underscored: true });

Sale.hasMany(SaleLine, { as: 'lines', foreignKey: 'saleId' });
SaleLine.belongsTo(Product, { as: 'product', foreignKey: 'productId' });
```

**`DECIMAL` returns a string** from `pg`, deliberately — JavaScript numbers
cannot represent all decimals exactly. Do not `parseFloat` it into money
arithmetic. Either keep money as integer minor units, or do decimal arithmetic
with a library. See `javascript`.

Model-level validation is a convenience, **not** a guarantee — it is skipped by
bulk operations and raw queries. The database constraint is the real rule; see
`constraints`.

### Scopes for tenant isolation

A `defaultScope` makes the safe query the default one:

```js
Product.addScope('defaultScope', { attributes: { exclude: ['costPrice'] } }, { override: true });
Product.addScope('forShop', (shopId) => ({ where: { shopId } }));

await Product.scope({ method: ['forShop', req.user.shopId] }).findAll();
```

This is structurally safer than remembering to add `where: { shopId }` at every
call site — but note `.unscoped()` bypasses it, so the scope is a strong default,
not an access control. Authorisation still belongs in the query; see
`authorization-security`.

### Avoiding N+1

```js
// ❌ 1 + N queries
const sales = await Sale.findAll({ where: { shopId } });
for (const s of sales) s.lines = await SaleLine.findAll({ where: { saleId: s.id } });

// ✅ one query
const sales = await Sale.findAll({
  where: { shopId },
  include: [{ model: SaleLine, as: 'lines' }],
});
```

Beware `include` with `limit`: Sequelize switches to a subquery, and the limit
applies to the parent rows — usually what you want, but verify. For deep
aggregation, a raw query with `bind` often beats a nested `include`.

### Fetch narrowly

```js
await Product.findAll({
  where: { shopId },
  attributes: ['id', 'name', 'unitPrice'],     // costPrice never loaded
  limit: Math.min(Number(req.query.limit) || 25, 100),
});
```

`attributes` is the cheapest defence against over-exposure — the sensitive column
never enters the process. See `excessive-data-exposure`.

### Transactions and locking

```js
await sequelize.transaction(async (t) => {
  const [affected] = await Stock.increment(
    { quantity: -qty },
    { where: { productId, shopId, quantity: { [Op.gte]: qty } }, transaction: t }
  );
  if (!affected) throw new InsufficientStockError();

  await Sale.create({ ... }, { transaction: t });
});
```

The managed form commits on resolve and rolls back on throw. **Every query inside
must pass `{ transaction: t }`** — one that forgets runs outside the transaction
on a different connection, which is a silent correctness bug.

For read-then-write that will not collapse into one statement, take a row lock:

```js
const stock = await Stock.findOne({
  where: { productId }, lock: t.LOCK.UPDATE, transaction: t,
});
```

Prefer the atomic `increment` with a guard predicate — see `concurrency`.

### Hooks

Useful for cross-cutting concerns (timestamps, audit rows), but hooks **do not
fire on bulk operations** unless `individualHooks: true`, and never on raw
queries. Business rules that must always hold belong in a service or a database
constraint, not a hook.

### Detection

```bash
grep -rn "sequelize.sync(" src/ --include=*.js
grep -rnE "sequelize\.query\(" src/ --include=*.js | grep -v "replacements\|bind"
grep -rn "literal(" src/ --include=*.js
grep -rnE "findAll\(|findOne\(" src/ --include=*.js | grep -v "attributes"
grep -rnB2 -A6 -E "for \(|\.map\(" src/ --include=*.js | grep -E "await .*(findAll|findOne|findByPk)"
```

### Checklist

- [ ] Schema changes via migrations; no `sync()` outside tests
- [ ] Every raw query uses `bind` or `replacements`
- [ ] Nothing user-controlled inside `literal()`; identifiers allow-listed
- [ ] `DECIMAL` values not coerced with `parseFloat` for money maths
- [ ] Tenant scoping in the query, not left to call-site discipline
- [ ] Associations eager-loaded; no queries inside loops
- [ ] `attributes` set so sensitive columns never load
- [ ] Pagination bounded server-side
- [ ] Every query inside a transaction passes `{ transaction: t }`
- [ ] Row locks or atomic guarded updates used for read-then-write
- [ ] Invariants enforced by database constraints, not only model validation

## References

- **Sequelize v6 documentation — Model Basics, Associations, Raw Queries,
  Transactions, Scopes, Eager Loading** <https://sequelize.org/docs/v6/>
- **Sequelize v6 — Raw Queries (`replacements` vs `bind`)**
  <https://sequelize.org/docs/v6/core-concepts/raw-queries/>
- **Sequelize v6 — Transactions and `lock`**
  <https://sequelize.org/docs/v6/other-topics/transactions/>
- **node-postgres documentation — type parsing** — why `DECIMAL`/`NUMERIC`
  returns a string <https://node-postgres.com/features/types>
- **OWASP SQL Injection Prevention Cheat Sheet** — the raw-query rules
  <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html>

**Not sourced — written for this framework:** the retail examples, the
detection commands, the "scope is a default not an access control" distinction,
and the checklist.
