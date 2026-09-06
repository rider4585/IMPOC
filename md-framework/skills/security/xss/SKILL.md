---
name: xss
version: 1.0.0
description: |
  Detect and remediate cross-site scripting in React/TypeScript applications —
  including the specific places React's automatic escaping does not protect you.
  Use when reviewing any code that renders user-controlled data, sets a URL from
  input, or injects markup, or when asked "check for XSS". CWE-79.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Cross-Site Scripting (CWE-79)

Attacker-controlled script executing in another user's session. In a POS or admin
system the payload runs with the privileges of whoever is logged in — often a
manager who can void sales and change prices.

### What React does and does not protect

React escapes text interpolated into JSX. That covers most rendering and is why
XSS in React is concentrated in a small number of known escapes:

```bash
grep -rn "dangerouslySetInnerHTML" src/ --include=*.jsx
grep -rnE "href=\{|src=\{|action=\{" src/ --include=*.jsx
grep -rnE "innerHTML|outerHTML|insertAdjacentHTML|document\.write" src/ --include=*.jsx
grep -rnE "\beval\(|new Function\(|setTimeout\(\s*[\"'\`]" src/ --include=*.js
```

| Escape | Why it bypasses escaping |
|---|---|
| `dangerouslySetInnerHTML` | Explicitly inserts raw HTML |
| `href` / `src` from input | `javascript:` and `data:` URLs execute |
| Direct DOM APIs | Bypass React entirely |
| `eval`, `Function`, string `setTimeout` | Input becomes code |
| Server-rendered templates | Not React's escaping at all |
| Injected `<script>` config / JSON-in-HTML | `</script>` in data breaks out |

### Remediation

**Rendering HTML.** If you must, sanitise with a maintained library, configured
allow-list only:

```js
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
```
Sanitise at render, not at storage — storing sanitised HTML loses the original
and re-sanitising on read is what actually protects you.

**URLs from input.** Validate the scheme against an allow-list before use:

```js
const safe = (u: string) => {
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(u, location.origin).protocol) ? u : '#'; }
  catch { return '#'; }
};
```

**JSON embedded in HTML.** Escape `<`, `>`, and `&` — or serve it from an
endpoint instead of inlining it.

**Stored XSS is the real risk here.** Product names, customer notes, supplier
details, and receipt footers are attacker-influenced and rendered to staff.
Review every field an outsider can populate that a staff member later views.

### Defence in depth

- **Content-Security-Policy** — a strict policy (no `unsafe-inline`, nonce or
  hash based) turns most XSS into a blocked console error. This is the single
  highest-value header.
- `HttpOnly` cookies so a successful XSS cannot read the session token.
- `X-Content-Type-Options: nosniff` and correct `Content-Type` on every response.

### Severity

`HIGH` for stored XSS reaching a privileged user. `MEDIUM` for reflected XSS
requiring a crafted link. `CRITICAL` if it reaches an admin surface that can
change roles or prices.

### Checklist

- [ ] Every `dangerouslySetInnerHTML` justified and sanitised at render
- [ ] URL-bearing attributes scheme-validated
- [ ] No direct DOM HTML injection
- [ ] No `eval` / `Function` / string-argument timers on input
- [ ] Inline JSON escaped or moved to an endpoint
- [ ] Outsider-populated fields rendered to staff reviewed for stored XSS
- [ ] CSP present and strict; session cookies `HttpOnly`
- [ ] Regression test added per finding

## References

- **OWASP Cross Site Scripting Prevention Cheat Sheet** — context-aware output
  encoding and sanitisation guidance
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- **OWASP DOM based XSS Prevention Cheat Sheet** — the direct-DOM sinks
  <https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html>
- **CWE-79** <https://cwe.mitre.org/data/definitions/79.html>
- **React documentation — `dangerouslySetInnerHTML`** — the documented escape
  hatch <https://react.dev/reference/react-dom/components/common>
- **MDN — Content Security Policy** — CSP as XSS mitigation
  <https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP>

**Not sourced — written for this framework:** the React-specific escape table,
the URL-scheme validator, the sanitise-at-render rule, and the retail stored-XSS
field list (product names, customer notes, receipt footers).
