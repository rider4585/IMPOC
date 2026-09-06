---
name: javascript
version: 1.0.0
description: |
  Write modern JavaScript correctly — ESM, async patterns, immutability,
  equality and coercion traps, and exact money arithmetic. Use when writing or
  reviewing any JS in this project, when a value is unexpectedly NaN or
  undefined, when handling currency, or when asked "is this idiomatic".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## JavaScript

Guidance for a codebase written in plain JavaScript, without a compiler to catch
type mistakes. That absence is the organising constraint: correctness has to come
from validated boundaries and disciplined patterns rather than from a type
checker.

> If TypeScript is adopted later, everything here still applies — the boundary
> validation simply gains compile-time reinforcement.

### Money — get this right first

JavaScript numbers are IEEE 754 doubles. They cannot represent `0.1` exactly.

```js
0.1 + 0.2            // 0.30000000000000004
1.005.toFixed(2)     // '1.00'  — not '1.01'
```

In a POS this becomes cent-level drift across thousands of transactions, and it
does not net out. Pick one representation and hold it everywhere:

**Integer minor units (recommended).**

```js
const toMinor = (major) => Math.round(Number(major) * 100);
const lineTotal = (unitPriceMinor, qty) => unitPriceMinor * qty;   // exact
const format = (minor, locale = 'en-IN', currency = 'INR') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
```

Rules that follow:

- Never `parseFloat` a `DECIMAL` column and do arithmetic on it. `pg` returns
  `NUMERIC` as a **string** precisely so you do not lose precision — see
  `sequelize`.
- Round exactly once, at a defined point in the calculation, in a defined
  direction. Record which — see `project-pricing-rules`.
- Never compare money with `===` after float arithmetic.
- Format only at the edge, for display. Never parse a formatted string back.

### Equality and coercion

Use `===`. The one defensible use of `==` is `x == null`, which tests `null` or
`undefined` together.

```js
[] + {}          // '[object Object]'
'2' * '3'        // 6
Number('')       // 0        ← empty string becomes zero
Number(' ')      // 0
Number(null)     // 0
Number(undefined)// NaN
```

`Number('')` returning `0` is the dangerous one: an empty form field silently
becomes a quantity of zero rather than an error. Validate at the boundary; do
not coerce — see `input-validation`.

### `??` and `?.` versus `||`

```js
const limit = req.query.limit ?? 25;   // ✅ only null/undefined fall through
const limit = req.query.limit || 25;   // ❌ 0 becomes 25
const qty   = input.quantity || 1;     // ❌ 0 becomes 1 — a real POS bug
```

`||` treats `0`, `''`, and `false` as absent. For quantities, prices, and
discounts that is wrong. Default with `??`.

### Async

```js
// ❌ sequential when the calls are independent
const shop    = await Shop.findByPk(shopId);
const product = await Product.findByPk(productId);

// ✅ concurrent
const [shop, product] = await Promise.all([
  Shop.findByPk(shopId),
  Product.findByPk(productId),
]);
```

- `Promise.all` rejects on the first failure. Use `Promise.allSettled` when you
  need every result regardless.
- **Never `await` inside a loop** over independent work — that is a sequential
  round trip per item. `Promise.all(items.map(fn))` unless order matters or you
  need to bound concurrency.
- `forEach` does not await. `arr.forEach(async …)` fires everything and continues
  immediately, swallowing rejections. Use `for…of` (sequential) or
  `Promise.all(map)` (concurrent).
- Every promise needs a rejection path. An unhandled rejection terminates the
  process by default in modern Node.

### Immutability

Mutating a shared object produces bugs that appear far from their cause.

```js
const next = { ...sale, status: 'void' };          // new object
const lines = [...sale.lines, newLine];            // new array
const updated = sale.lines.map((l) =>
  l.id === id ? { ...l, quantity: qty } : l);
```

Note spread is **shallow** — nested objects are still shared. Use
`structuredClone(value)` for a genuine deep copy.

Prefer `map`/`filter`/`reduce` over index loops when transforming. Reach for a
plain loop when you need early exit or the logic is genuinely imperative;
clarity beats style points.

### Modules — this project is ESM

`"type": "module"` in `package.json` means:

- `import`/`export`, not `require`
- **Relative imports need the file extension**: `./sale.service.js`, not
  `./sale.service`
- No `__dirname`/`__filename` — use
  `import.meta.dirname` (Node 20.11+) or `fileURLToPath(import.meta.url)`
- JSON needs an import attribute: `import pkg from './x.json' with { type: 'json' }`
- Top-level `await` is available

### Errors

Throw `Error` instances, never strings — a thrown string has no stack.

```js
class InsufficientStockError extends Error {
  constructor(productId) {
    super(`Insufficient stock for product ${productId}`);
    this.name = 'InsufficientStockError';
    this.status = 409;
    this.productId = productId;
  }
}
```

Preserve the cause when rethrowing: `throw new Error('msg', { cause: err })`.
See `error-handling`.

### Detection

```bash
grep -rnE "parseFloat\(|toFixed\(" src/ --include=*.js | grep -iE "price|total|amount|cost|discount"
grep -rnE "(quantity|price|total|amount|discount)\s*\|\|" src/ --include=*.js
grep -rn "forEach(async" src/ --include=*.js
grep -rnE "for \(.*\)\s*\{[^}]*await" src/ --include=*.js
grep -rnE "[^=!]==[^=]" src/ --include=*.js | grep -v "== null"
```

### Checklist

- [ ] Money is integer minor units or decimal strings — never float arithmetic
- [ ] `DECIMAL` values not `parseFloat`ed
- [ ] Rounding happens once, at a defined point and direction
- [ ] `??` used for defaults on numeric fields, not `||`
- [ ] `===` throughout, except deliberate `== null`
- [ ] No `await` inside loops over independent work
- [ ] No `async` callbacks passed to `forEach`
- [ ] Every promise has a rejection path
- [ ] Shared state not mutated; deep copies use `structuredClone`
- [ ] Relative imports include the `.js` extension
- [ ] Errors are `Error` subclasses with a `cause` when rethrown

## References

- **MDN JavaScript reference** — equality, coercion, nullish coalescing, spread,
  `structuredClone` <https://developer.mozilla.org/en-US/docs/Web/JavaScript>
- **ECMA-262 / IEEE 754** — double-precision representation and why `0.1 + 0.2`
  is inexact <https://tc39.es/ecma262/>
- **Node.js documentation — ECMAScript modules** — extension requirement,
  `import.meta.dirname`, import attributes
  <https://nodejs.org/api/esm.html>
- **MDN — `Intl.NumberFormat`** — currency formatting at the display edge
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat>
- **Martin Fowler — Money pattern** — minor-units representation
  <https://martinfowler.com/eaaCatalog/money.html>

**Not sourced — written for this framework:** the money rules and helpers, the
`||`-versus-`??` quantity bug, the detection commands, and the checklist.
