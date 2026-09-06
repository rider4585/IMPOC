---
name: bundle-analysis
version: 1.0.0
description: |
  Inspect what ships to the browser — reading a treemap, finding duplicate and
  oversized dependencies, tracking budgets, and deciding what to cut or split.
  Use after adding a dependency, when load is slow, or when asked "why is the
  bundle so large". For build configuration see the vite skill.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Bundle Analysis

JavaScript is the most expensive asset a browser handles — it must be downloaded,
parsed, compiled, and executed. On a till terminal over shop wifi, bundle size is
often the largest single factor in how long the morning's first load takes.

**Look at the bundle after every dependency addition.** It is the cheapest habit
available and it prevents the slow accumulation that nobody notices.

### Measure

```bash
npm run build
ls -lh dist/assets/*.js | sort -k5 -h            # what actually shipped
npx vite-bundle-visualizer                        # treemap
```

Report **gzipped or brotli** sizes, not raw — that is what crosses the network.
Raw size still matters for parse and execute cost on a slow device, so note both.

### Reading a treemap

Work from the largest block inward and ask, in order:

1. **What is this?** A dependency, your code, or a polyfill?
2. **Do we use all of it?** A charting library imported wholesale for one chart.
3. **Is it needed on first load?** Reports and PDF generation are not.
4. **Is there a smaller equivalent?** Or none at all?
5. **Is it duplicated?** Two versions of the same package.

The first two questions usually account for most of the surprise.

### The usual offenders

| Finding | Fix |
|---|---|
| A whole icon set | Import icons individually |
| Date library with all locales | Import the one locale, or use `Intl` |
| Charting library imported wholesale | Import only the chart types used |
| Duplicate dependency versions | Deduplicate or align versions |
| Moment/lodash-style full imports | Per-function imports, or native equivalents |
| A polyfill for browsers you do not support | Tighten the browser target |
| Dev-only code shipped | Ensure it is behind a build condition |
| Barcode/PDF libraries on the till bundle | Lazy-load at the route |

```bash
npm ls react react-dom                  # duplicates = two copies bundled
npx depcheck                            # dependencies nothing imports
grep -rn "^import .* from '" src/ --include=*.jsx | grep -vE "^\S+:import \{" | head -20
```

The last one finds default/namespace imports, which are the ones most likely to
defeat tree-shaking.

### Tree-shaking only works when the library allows it

```js
import { Search } from 'lucide-react';        // ✅ if ESM and side-effect-free
import * as Icons from 'lucide-react';        // ❌ pulls everything
import _ from 'lodash';                       // ❌ CommonJS, no shaking
import debounce from 'lodash/debounce';       // ✅ single module
```

Verify by rebuilding and checking the treemap — do not assume a named import
shook. A package without `"sideEffects": false` and without an ESM build will not
tree-shake regardless of how you import it.

### Split at route boundaries

```jsx
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
```

Split the heavy, infrequently used: reports, charts, PDF generation, barcode
rendering, admin screens.

**Do not split the till screen.** It is the hot path; a lazy chunk there adds a
round trip at exactly the wrong moment. Splitting is a trade — pay it where the
route is rare.

Keep stable vendor code in its own chunk so an application deploy does not
invalidate React for every user — see `vite`.

### Set and enforce a budget

An unmeasured bundle only grows. Pick a number and fail the build on regression:

```
Initial JS (gzipped)   ≤ 200 KB
Total initial transfer ≤ 350 KB
Any single lazy chunk  ≤ 150 KB
```

```bash
# Simple CI gate
SIZE=$(gzip -c dist/assets/index-*.js | wc -c)
[ "$SIZE" -lt 204800 ] || { echo "Bundle over budget: $SIZE bytes"; exit 1; }
```

A budget converts "the bundle grew a bit" into a decision someone has to make.

### Before adding a dependency, ask

1. Can the platform do this? (`Intl`, `fetch`, `structuredClone`,
   `crypto.randomUUID`, `AbortController`)
2. How large is it, gzipped, with its own dependencies?
3. Does it tree-shake?
4. Is it maintained? (see `dependency-vulnerabilities`)
5. Would 30 lines of our own code do?

Check the cost before installing, not after. A dependency is also a security and
maintenance liability — see `supply-chain-security`.

### Beyond JavaScript

- **Fonts** — subset them; self-hosted variable fonts are already efficient, but
  shipping every weight is not
- **Images** — modern formats, sized for display, lazy-loaded below the fold
- **CSS** — check for unused rules as the app grows

### Checklist

- [ ] Bundle inspected after every dependency addition
- [ ] Sizes reported gzipped, with raw noted for parse cost
- [ ] Treemap reviewed largest-first
- [ ] No duplicate dependency versions
- [ ] Icons and utilities imported per item
- [ ] Tree-shaking verified in the output, not assumed
- [ ] Heavy routes lazy-loaded; till screen not split
- [ ] Vendor chunk separated for caching
- [ ] Budget defined and enforced in CI
- [ ] Platform capabilities checked before adding a dependency
- [ ] Unused dependencies removed
- [ ] Fonts and images reviewed alongside JavaScript

## References

- **Vite documentation — Building for Production, `manualChunks`**
  <https://vite.dev/guide/build>
- **web.dev — Reduce JavaScript payloads with code splitting; performance
  budgets** <https://web.dev/articles/reduce-javascript-payloads-with-code-splitting>
- **Rollup documentation — Tree-shaking and `sideEffects`**
  <https://rollupjs.org/introduction/#tree-shaking>
- **Chrome DevTools — Coverage panel** — finding unused shipped code
  <https://developer.chrome.com/docs/devtools/coverage>
- **Bundlephobia** — dependency cost before installing
  <https://bundlephobia.com/>

**Not sourced — written for this framework:** the offender table, the
before-adding checklist, the concrete budget numbers and CI gate, and the
do-not-split-the-till-screen rule.
