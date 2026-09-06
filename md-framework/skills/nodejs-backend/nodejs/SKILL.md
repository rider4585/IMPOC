---
name: nodejs
version: 1.0.0
description: |
  Work correctly with the Node.js runtime — the event loop and blocking, streams
  for large data, process lifecycle and signals, unhandled rejections, and
  runtime-level performance. Use when the server stalls under load, when handling
  files or exports, when configuring process behaviour, or when asked "why is
  Node slow here".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Node.js Runtime

Node runs your JavaScript on **one thread**. Everything that matters at the
runtime level follows from that: work that blocks the event loop blocks every
concurrent request, not just the one that caused it.

### Do not block the event loop

While synchronous work runs, no other request progresses. In a POS this means one
export can freeze every till.

```js
// ❌ blocks everyone
const rows = fs.readFileSync('products.csv', 'utf8').split('\n');
const hash = crypto.pbkdf2Sync(pw, salt, 600_000, 32, 'sha256');
const data = JSON.parse(hugeString);          // sync, and unavoidable — bound the size

// ✅ non-blocking
const rows = await fs.promises.readFile('products.csv', 'utf8');
const hash = await argon2.hash(pw);           // async, runs on the thread pool
```

The usual offenders:

| Blocking work | Instead |
|---|---|
| `*Sync` fs calls in a request path | Async `fs.promises` |
| Password hashing (`pbkdf2Sync`, sync bcrypt) | Async hashing — argon2 is async by default |
| `JSON.parse` on a very large body | Bound the body size; stream if genuinely large |
| Big loops over thousands of rows | Do it in SQL, or chunk with yields |
| Regex with catastrophic backtracking | Simplify; bound input length |
| Sync compression, PDF or image generation | Async APIs, or a worker thread |

**PDF and barcode generation are exactly this class of work.** Generating a large
receipt or a batch of labels synchronously in the request path will stall the
server — use the streaming APIs, and consider a queue for batch jobs.

For genuinely CPU-bound work, use `worker_threads` — not more processes and not
`setTimeout`.

### Streams for large data

Loading a whole export into memory scales until it doesn't.

```js
// ❌ entire result set in memory, then one big response
const sales = await Sale.findAll({ where: { shopId } });
res.json(sales);

// ✅ stream out, constant memory
res.setHeader('Content-Type', 'text/csv');
await pipeline(queryStream, csvTransform, res);
```

Use `stream/promises.pipeline` — it propagates errors and cleans up on failure,
which manual `.pipe()` chains do not. Backpressure is handled for you; that is
the point of using it.

### Process lifecycle

```js
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled rejection');
  process.exit(1);                 // let the supervisor restart cleanly
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  process.exit(1);
});
```

Do **not** swallow these to "keep the server up". After an uncaught exception the
process is in an unknown state — continuing risks corrupt writes. Log, exit, let
the supervisor restart. Graceful shutdown on `SIGTERM` is in `express`.

### Environment and configuration

Read configuration once at startup, validate it, and fail fast if it is missing.
Scattered `process.env` reads make the real configuration surface invisible — see
`configuration`.

### Performance work

Measure before changing anything.

```bash
node --prof server.js && node --prof-process isolate-*.log   # CPU profile
node --inspect server.js                                     # Chrome DevTools
node --max-old-space-size=2048 server.js                     # heap ceiling
```

- Event loop lag is the metric that matters most — rising lag means something is
  blocking. Expose it as a health metric.
- Memory growth across requests usually means a leak: an unbounded cache, a
  growing array, listeners added per request without removal, or a closure
  holding a large object.
- `require`/`import` of a huge module at request time — hoist it to module scope.

### Version and dependency hygiene

- Pin the Node version (`engines` in `package.json`, plus `.nvmrc`) so local, CI,
  and production agree.
- Prefer built-ins. Node now covers `fetch`, `test`, `crypto.randomUUID`,
  `structuredClone`, and `AbortController` — each is one fewer dependency to
  audit. See `supply-chain-security`.

### Detection

```bash
grep -rnE "\b(readFileSync|writeFileSync|existsSync|execSync|pbkdf2Sync)\(" src/ --include=*.js
grep -rn "unhandledRejection\|uncaughtException" src/ --include=*.js
grep -rn "\.pipe(" src/ --include=*.js          # prefer pipeline()
grep -rn "process.env" src/ --include=*.js | wc -l
```

### Checklist

- [ ] No `*Sync` calls in any request path
- [ ] Password hashing is async
- [ ] Large exports and PDFs streamed, not buffered
- [ ] `pipeline()` used rather than manual `.pipe()`
- [ ] CPU-bound work moved to worker threads or a queue
- [ ] `unhandledRejection` and `uncaughtException` log and exit
- [ ] Configuration read and validated once at startup
- [ ] Event loop lag exposed as a metric
- [ ] Node version pinned
- [ ] Built-ins preferred over dependencies where equivalent

## References

- **Node.js documentation — Don't Block the Event Loop**
  <https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop>
- **Node.js documentation — Stream / `stream/promises.pipeline`**
  <https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-options>
- **Node.js documentation — Process events (`unhandledRejection`,
  `uncaughtException`, signals)** <https://nodejs.org/api/process.html>
- **Node.js documentation — Worker threads**
  <https://nodejs.org/api/worker_threads.html>
- **Node.js documentation — Diagnostics and profiling**
  <https://nodejs.org/en/learn/diagnostics/profiling>

**Not sourced — written for this framework:** the blocking-work table, the
PDF/barcode generation warning specific to this project's dependencies, the
detection commands, and the checklist.
