---
name: vite
version: 1.0.0
description: |
  Configure and use Vite — dev server, environment variables, path aliases, code
  splitting, build output, and bundle analysis. Use when changing build
  configuration, when the bundle is too large, when an environment variable is
  undefined at runtime, or when asked "why isn't this loading in production".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Vite

Documents **Vite 8** with React. Most Vite problems are one of three things: an
environment variable that is not prefixed, a path that works in dev but not in
the build, or a bundle nobody has looked at.

### Environment variables — the security-critical rule

```js
import.meta.env.VITE_API_URL      // ✅ exposed to the client, by design
import.meta.env.DATABASE_URL      // undefined — not prefixed, so not exposed
process.env.ANYTHING              // ❌ not available in the browser
```

**Only `VITE_`-prefixed variables reach the client — and every one of them is
public.** They are inlined into the built JavaScript, which any user can read.

Never prefix a secret. `VITE_API_SECRET`, `VITE_JWT_SECRET`, or a payment key
with a `VITE_` prefix is a published credential — `CRITICAL`, and it must be
rotated, not merely renamed. See `secrets-detection`.

If the browser needs it, it is not a secret. Anything that must stay private
belongs on the server — see `configuration`.

```bash
# Verify what actually shipped
grep -roE "VITE_[A-Z_]+" src/ | sort -u
grep -rniE "(secret|password|private|token)" .env* | grep VITE_    # must be empty
```

### Configuration

```js
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {                                  // avoids CORS and cookie issues in dev
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    sourcemap: mode !== 'production',         // never ship source maps publicly
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
}));
```

Two things worth stating:

- **Source maps must not be served in production.** They publish your original
  source. Generate them for error reporting if you need them, but upload them to
  the reporting service rather than the web root — see
  `security-misconfiguration`.
- **The dev proxy** keeps the frontend same-origin with the API, so `httpOnly`
  auth cookies work in development exactly as in production.

### Path aliases

Configure the alias in **both** Vite and the editor/lint resolver, or imports
resolve at build time but show as errors in the editor. With `jsconfig.json`:

```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
```

### Code splitting

Split at route boundaries — see `routing`.

```jsx
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
```

Split the heavy, infrequently used routes: reports, charts, PDF generation,
barcode rendering. **Do not split the till screen** — it is the hot path and
should be in the initial bundle.

`manualChunks` for stable vendor code improves caching: an application deploy
does not invalidate the React bundle.

### Look at the bundle

```bash
npm run build -- --report        # or add rollup-plugin-visualizer
npx vite-bundle-visualizer
ls -lh dist/assets/*.js | sort -k5 -h
```

Check after adding any dependency. The usual surprises: a whole icon set, a
date library with all locales, a charting library imported wholesale, or a
duplicated dependency at two versions.

```bash
npm ls react            # more than one version = duplicated bundle
```

Prefer per-item imports (`import { Search } from 'lucide-react'`) and confirm the
library is actually tree-shakeable — many are not.

### Static assets

- Imported assets get hashed filenames and long-lived caching. Prefer imports.
- `public/` is copied verbatim without hashing — use it only for files that need
  a fixed URL (`favicon.ico`, `robots.txt`, `manifest.json`).
- Reference imported assets by variable, never by a hand-written path into
  `public/`, or the hashing and cache-busting are lost.

### Dev vs production differences

Vite serves unbundled ES modules in development and a Rollup build in
production. Things that only break in the build:

- Case-sensitive import paths (macOS is forgiving, Linux CI is not)
- Missing file extensions in relative imports
- Code depending on module evaluation order
- Environment variables present locally but absent in CI

**Run `npm run build && npm run preview` before every deploy.** It takes seconds
and catches all of the above.

### Detection

```bash
grep -rn "process.env" src/ --include=*.jsx --include=*.js       # won't exist in browser
grep -rniE "VITE_.*(SECRET|PASSWORD|KEY|TOKEN)" .env* 2>/dev/null
grep -rn "sourcemap" vite.config.js
grep -rn "lazy(" src/ --include=*.jsx | wc -l
ls -lh dist/assets/*.js 2>/dev/null | awk '{print $5, $9}'
```

### Checklist

- [ ] Only non-secret values carry the `VITE_` prefix
- [ ] No secret has ever been `VITE_`-prefixed (rotate if so)
- [ ] `process.env` not used in client code
- [ ] Source maps disabled or not publicly served in production
- [ ] Dev proxy configured so cookies behave as in production
- [ ] Path aliases configured in Vite and the editor resolver
- [ ] Heavy routes lazy-loaded; the till screen is not
- [ ] Vendor chunks split for caching
- [ ] Bundle inspected after each dependency addition
- [ ] No duplicated dependency versions
- [ ] Icons and utilities imported per item
- [ ] Assets imported rather than referenced from `public/`
- [ ] `build` + `preview` run before every deploy

## References

- **Vite documentation — Env Variables and Modes** — the `VITE_` prefix rule and
  client exposure <https://vite.dev/guide/env-and-mode>
- **Vite documentation — Building for Production / Build Options**
  <https://vite.dev/guide/build>
- **Vite documentation — Server Options (proxy)**
  <https://vite.dev/config/server-options>
- **Vite documentation — Static Asset Handling**
  <https://vite.dev/guide/assets>
- **Rollup documentation — `output.manualChunks`**
  <https://rollupjs.org/configuration-options/#output-manualchunks>

**Not sourced — written for this framework:** the "if the browser needs it, it is
not a secret" rule and rotation requirement, the till-screen splitting guidance,
the dev-vs-build failure list, and the detection commands.
