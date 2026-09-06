---
name: express
version: 1.0.0
description: |
  Structure Express applications correctly — middleware ordering, routing,
  async error handling, and the Express 5 behaviours that differ from v4. Use
  when adding routes or middleware, structuring an API server, debugging why a
  handler is not reached, or when asked "how should this route be organised".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Express

Express is unopinionated, which means the structure is your responsibility.
Almost every Express defect is one of two things: middleware in the wrong order,
or an error that never reached the error handler.

> **Version note.** This documents **Express 5**. Where v4 differs materially it
> is called out — the async behaviour change is the one that matters most.

### Express 5 vs 4 — what actually changed

| Behaviour | Express 4 | Express 5 |
|---|---|---|
| Rejected promise in a handler | **Silently hangs** — needs a wrapper | Automatically forwarded to the error handler |
| `req.params`/`query` prototype | Object with prototype | Null-prototype object |
| Path patterns | Loose regex-ish strings | Stricter; `*` must be named, e.g. `/*splat` |
| `res.status(undefined)` | Coerced | Throws |

If the codebase still wraps every async handler in a `catchAsync` helper, that is
v4 residue — harmless, but no longer required. **Do not** add new wrappers; do
not remove existing ones as drive-by cleanup either.

```js
// Express 5 — a rejection here reaches the error handler on its own
router.post('/sales', validate(CreateSale), async (req, res) => {
  const sale = await saleService.create(req.validated, req.user);
  res.status(201).json(toSaleResponse(sale));
});
```

### Middleware order is the execution order

Middleware runs top to bottom. Ordering mistakes produce bugs that look like
anything but ordering mistakes.

```js
app.use(helmet());                       // 1. security headers, before anything
app.use(cors({ origin: ALLOWED, credentials: true }));
app.use(express.json({ limit: '1mb' })); // 2. body parsing, with a bound
app.use(cookieParser());
app.use(requestId);                      // 3. correlation id, before logging
app.use(httpLogger);                     // 4. logging, so it sees every request
app.use('/api/v1', apiRouter);           // 5. routes
app.use(notFoundHandler);                // 6. 404 — after all routes
app.use(errorHandler);                   // 7. errors — LAST, and 4-arity
```

The rules that matter:

- **Body size limit is not optional.** `express.json()` with no `limit` accepts
  ~100 KB by default in v5, but set it explicitly so the bound is visible.
- **The error handler must be registered last**, and must take **four**
  parameters. A three-parameter function is treated as ordinary middleware and
  will never receive errors — the single most common Express mistake.
- **Auth middleware belongs on the router, not repeated per route**, so a new
  route cannot be added unprotected by omission.

### Routing structure

Keep routes thin. A route file declares the surface; it does not contain logic.

```
src/
  routes/          # path → middleware chain → controller. No business logic.
  controllers/     # HTTP in, HTTP out. Parse, call service, shape response.
  services/        # business rules. No req/res. Testable without HTTP.
  models/          # Sequelize models
  middleware/      # auth, validation, error handling, logging
```

The dividing line: **a service must never receive `req` or `res`.** Once it does,
it can only be tested through HTTP and can no longer be called from a job, a CLI
task, or another service.

```js
// routes/sale.routes.js
const router = Router();
router.use(requireAuth);                                    // applies to all below
router.get('/',      requireRole('staff'),   listSales);
router.post('/',     requireRole('staff'),   validate(CreateSale), createSale);
router.post('/:id/void', requireRole('manager'), validate(VoidSale), voidSale);
export default router;
```

### Mount versioned, not bare

```js
app.use('/api/v1', apiRouter);
```

Versioning at the mount point costs nothing now and is the only cheap moment to
add it.

### Reading request data

- Read from the **validated** result, not `req.body` — see `input-validation`.
- Read identity from the verified session/token (`req.user`), **never** from the
  body or a header the client controls.
- Set `app.set('trust proxy', …)` correctly when behind a proxy, or `req.ip` is
  the proxy's address and every rate limit collapses to one bucket.

### Graceful shutdown

Without this, a deploy drops in-flight checkouts.

```js
const server = app.listen(PORT);

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    server.close(async () => {          // stop accepting, finish in-flight
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();   // hard cap
  });
}
```

### Detection

```bash
# Error handler arity — must be 4 params
grep -rnE "app\.use\(\s*(async\s*)?\(?\s*err" src/ --include=*.js
# Routes without an auth guard nearby
grep -rnE "router\.(get|post|put|patch|delete)\(" src/ --include=*.js | head -40
# Business logic leaking into controllers
grep -rnE "(sequelize|Model|findAll|findOne)" src/controllers/ --include=*.js
# Unbounded body parser
grep -rn "express.json(" src/ --include=*.js
```

### Checklist

- [ ] Error handler registered last, with four parameters
- [ ] `express.json()` has an explicit `limit`
- [ ] Security headers and CORS registered before routes
- [ ] Auth applied at router level, not per route
- [ ] Routes contain no business logic; services never see `req`/`res`
- [ ] API mounted under a version prefix
- [ ] Identity read from the verified session, never the request body
- [ ] `trust proxy` set correctly if behind a proxy
- [ ] Graceful shutdown closes the server and the database pool
- [ ] No new `catchAsync` wrappers added (Express 5 handles rejections)

## References

- **Express 5 documentation — Routing, Writing middleware, Error handling**
  <https://expressjs.com/en/guide/error-handling.html>
- **Express 5 migration guide** — the v4→v5 behaviour changes in the table above
  <https://expressjs.com/en/guide/migrating-5.html>
- **Express — Production best practices: performance and reliability**
  <https://expressjs.com/en/advanced/best-practice-performance.html>
- **Express — Production best practices: security**
  <https://expressjs.com/en/advanced/best-practice-security.html>
- **Node.js documentation — `net.Server.close()` / process signals** — graceful
  shutdown <https://nodejs.org/api/net.html#serverclosecallback>

**Not sourced — written for this framework:** the layer boundary rule (services
never receive `req`/`res`), the middleware ordering rationale, the detection
commands, and the graceful-shutdown example.
