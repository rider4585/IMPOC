---
name: error-handling
version: 1.0.0
description: |
  Handle errors consistently across backend and frontend — error taxonomy,
  typed error classes, a single Express error boundary, React error boundaries,
  retry, and user-facing messaging. Shared by backend and frontend agents. Use
  when adding error handling, when failures are silent or leak internals, or when
  asked "how should this failure be handled".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Error Handling

One shared skill for both ends of the stack, because the taxonomy and the
principles are the same and only the mechanism differs.

### The taxonomy

Classify before deciding how to handle. Almost every handling mistake is a
misclassification.

| Class | Meaning | Handling |
|---|---|---|
| **Expected / domain** | A valid request the rules reject — insufficient stock, sale already voided | Return a specific status and a message the user can act on. Not an incident. |
| **Validation** | Malformed input | `400` with field-level detail |
| **Authorisation** | Not permitted | `401`/`403`/`404` per `rest-api` |
| **Transient** | Timeout, deadlock, network blip | Retry with backoff, then surface |
| **Programmer** | Null dereference, bad state | Do not catch locally. Let it reach the boundary, log with stack, fix the code |
| **Fatal** | Unrecoverable process state | Log and exit; supervisor restarts |

The two most common errors about errors: catching programmer errors and
continuing with corrupt state, and treating expected domain outcomes as
exceptions that alarm someone at 3 a.m.

### Principles (both ends)

1. **Fail loudly, degrade deliberately.** A swallowed error is a bug you will
   debug twice — once now, invisibly, and once later with no clue.
2. **Never `catch` without acting.** Handling, enriching, or translating is
   acting; an empty block or a bare `console.log` is not.
3. **Catch narrowly.** Wrap the operation that can fail, not the whole function.
4. **Preserve the cause.** `throw new Error('...', { cause: err })`.
5. **One boundary per surface.** Errors converge on a single place that decides
   the response. Scattered handling produces inconsistent output.
6. **Internal detail never crosses the boundary.** Stack traces, SQL, file paths,
   and driver messages stay in logs.
7. **Correlation id in both the log and the response**, so a user's screenshot
   maps to a log line.

---

## Backend

### Typed error classes

```js
export class AppError extends Error {
  constructor(message, { status = 500, code, expose = false, cause, meta } = {}) {
    super(message, { cause });
    this.name = new.target.name;
    this.status = status;
    this.code = code ?? 'internal_error';
    this.expose = expose;          // may this message reach the client?
    this.meta = meta;
  }
}

export class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', { status: 400, code: 'validation_failed', expose: true });
    this.errors = errors;
  }
}

export class InsufficientStockError extends AppError {
  constructor(productId, available, requested) {
    super(`Insufficient stock`, {
      status: 409, code: 'insufficient_stock', expose: true,
      meta: { productId, available, requested },
    });
  }
}
```

The `expose` flag is the mechanism that keeps internals in: the boundary sends
`error.message` only when `expose` is true, and a generic message otherwise.

### The single Express boundary

```js
// LAST middleware, and it must take four parameters
export function errorHandler(err, req, res, _next) {
  const status = err.status ?? 500;

  if (status >= 500) {
    req.log.error({ err, requestId: req.id }, 'request failed');   // full stack
  } else {
    req.log.warn({ code: err.code, requestId: req.id }, 'request rejected');
  }

  res.status(status).json({
    title: err.expose ? err.message : 'Something went wrong',
    status,
    code: err.code ?? 'internal_error',
    requestId: req.id,
    ...(err.errors && { errors: err.errors }),
  });
}
```

A three-parameter error handler is never called — see `express`.

**Express 5 forwards rejected promises automatically**, so `async` handlers need
no wrapper.

Translate infrastructure errors into domain errors at the layer that understands
them — a Sequelize `UniqueConstraintError` becomes a `409 duplicate_sku` in the
service, not in the boundary.

---

## Frontend

### React error boundaries

Boundaries catch render errors. They do **not** catch errors in event handlers,
async callbacks, or effects — those need explicit handling.

```jsx
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { reportError(error, info); }
  render() {
    return this.state.error
      ? <ErrorFallback onRetry={() => this.setState({ error: null })} />
      : this.props.children;
  }
}
```

Place boundaries per meaningful region, not only at the root. A failed sales
chart should not blank the till screen.

### Async and request errors

```js
try {
  const { data } = await api.post('/sales', payload);
  return data;
} catch (err) {
  if (!err.response) throw new NetworkError('Connection lost', { cause: err });
  const { status, data } = err.response;
  if (status === 409) throw new DomainError(data.title, { code: data.code });
  if (status === 401) { redirectToLogin(); return; }
  throw new AppError('Request failed', { cause: err, requestId: data?.requestId });
}
```

### Every async surface has three states

Loading, error, and empty are part of the feature, not polish. A component that
renders only the success path will show a blank screen on failure.

### Retry

Retry **transient** failures only — network errors, timeouts, `5xx`, `429`. Never
retry `4xx`: the request is wrong and will stay wrong. Never retry a
non-idempotent write without an idempotency key (see `rest-api`). Use exponential
backoff with jitter, and cap the attempts.

### Messaging

Say what happened and what to do. "Not enough stock — 2 units available" beats
"Error 409". Show the correlation id on unexpected failures so support can find
the log. Never render a raw error object.

---

### Detection

```bash
grep -rnE "catch\s*\([^)]*\)\s*\{\s*\}" src/ --include=*.js --include=*.jsx   # empty catch
grep -rn "catch" src/ --include=*.js --include=*.jsx | grep -c "console.log"
grep -rnE "app\.use\(\s*(async\s*)?\(?\s*err" src/ --include=*.js             # handler arity
grep -rn "ErrorBoundary" src/ --include=*.jsx
grep -rnE "(err|error)\.(stack|message)" src/ --include=*.js | grep -iE "res\.|json\(|send\("
```

The last command finds internal detail being sent to clients.

### Checklist

- [ ] Errors classified before handling
- [ ] Domain errors are typed classes with a status and a code
- [ ] `expose` (or equivalent) gates which messages reach clients
- [ ] Single Express error boundary, registered last, four parameters
- [ ] Infrastructure errors translated to domain errors in the service layer
- [ ] No empty catches; nothing caught without being acted on
- [ ] `cause` preserved when rethrowing
- [ ] No stack traces, SQL, or paths in responses
- [ ] Correlation id in both log and response
- [ ] React error boundaries around meaningful regions
- [ ] Loading, error, and empty states implemented for every async surface
- [ ] Retry limited to transient failures, with backoff and a cap
- [ ] User-facing messages say what to do next

## References

- **Node.js — Error handling / `Error` `cause`**
  <https://nodejs.org/api/errors.html>
- **Express 5 documentation — Error handling** — four-parameter handlers and
  automatic promise rejection forwarding
  <https://expressjs.com/en/guide/error-handling.html>
- **RFC 9457 — Problem Details for HTTP APIs** — response shape
  <https://datatracker.ietf.org/doc/html/rfc9457>
- **React documentation — Error boundaries** — what they do and do not catch
  <https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary>
- **AWS Architecture Blog — Exponential backoff and jitter** — retry strategy
  <https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/>
- **OWASP Error Handling Cheat Sheet** — not leaking internals
  <https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html>

**Not sourced — written for this framework:** the six-class taxonomy, the
`expose` flag pattern, the retail error examples, the detection commands, and the
checklist.
