---
name: secure-code-review
version: 1.0.0
description: |
  Systematic security review of a code diff or module: trace untrusted input from
  entry to sink, verify authorisation and validation, and report findings with
  severity, attack path, and remediation. The parent method that the specific
  vulnerability skills plug into. Use when asked to "security review this",
  "review this diff for vulnerabilities", "is this code safe", before merging any
  change, or as the code-security lane of a review gate.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Secure Code Review

Find the vulnerability the author did not know they were writing. You report;
you never fix — authoring a change destroys your objectivity about it.

### The method: trace, don't scan

Pattern-matching on dangerous function names produces false positives and misses
real defects. Follow the data instead.

1. **Enumerate entry points in the change.** Route handlers, message consumers,
   file/CSV imports, webhook receivers, scheduled jobs reading stored data, and
   any parameter reaching them.

2. **For each input, trace to every sink.** A sink is anywhere input leaves your
   control: SQL, shell, filesystem path, HTTP request, template, deserializer,
   redirect, or a rendered DOM node. Record the path as
   `entry → transform → sink` with file:line at each hop.

3. **At each hop ask three questions.**
   - Is it *validated* — type, range, length, format, at the boundary?
   - Is it *authorised* — may this user act on this specific object?
   - Is it *encoded* for the sink it reaches?

   A path missing any of the three is a finding.

4. **Check the error and edge paths.** Stack traces, verbose errors, debug
   branches, and catch blocks leak more than the happy path. Review them
   explicitly — they are usually unreviewed.

5. **Review the arithmetic that moves money or stock.** Sign checks, overflow,
   float usage, rounding, and unguarded negative quantities. In a POS these are
   security defects, not merely bugs.

6. **Scan for secrets last.** A credential in the diff is `CRITICAL` regardless
   of everything else. See `secrets-detection`.

### Starting greps (Node/TypeScript)

Use these to locate candidates, then **trace each one** before reporting.

```bash
# Injection sinks
grep -rnE "\\\$\{[^}]*\}|\+ *(req|input|params|body|query)\." src/ --include=*.js | grep -iE "query|exec|sql"
grep -rnE "(exec|execSync|spawn)\(" src/ --include=*.js
# Unsafe rendering
grep -rn "dangerouslySetInnerHTML\|innerHTML" src/ --include=*.jsx
# Deserialization / dynamic evaluation
grep -rnE "\beval\(|new Function\(|vm\.run|yaml\.load\(" src/ --include=*.js
# Missing authorisation around identifier use
grep -rnE "findByPk|findOne|findAll" src/ --include=*.js
```

### Severity

Rate with CVSS 3.1 reasoning — exploitability and impact, not how alarming the
code looks. Map to the shared scale:

| Level | Meaning |
|---|---|
| `CRITICAL` | Exploitable now by a reachable actor; money, card data, or cross-tenant loss |
| `HIGH` | Serious flaw behind a precondition (authenticated, specific role) |
| `MEDIUM` | Real problem, bounded blast radius |
| `LOW` | Hardening; fix when convenient |
| `INFO` | Observation |

### Reporting

Every finding carries:

```
SEVERITY   HIGH
LOCATION   src/modules/sales/sale.service.ts:142
WEAKNESS   CWE-89 SQL Injection
PATH       POST /api/sales body.note → buildQuery():88 → db.raw():142
IMPACT     Authenticated cashier can read any shop's sales
FIX        Parameterise; bind note as a value, never interpolate
```

No attack path means it is not a vulnerability — label it a hardening
suggestion instead.

### Checklist

- [ ] Every changed line read
- [ ] Every input traced entry → sink
- [ ] Validation confirmed at the boundary
- [ ] Object-level authorisation confirmed on every identifier
- [ ] Output encoded per sink context
- [ ] Error paths reviewed for disclosure
- [ ] Money/stock arithmetic checked
- [ ] Diff scanned for credentials
- [ ] Verdict issued, or explicit PASS

## References

- **OWASP Code Review Guide v2.0** — the trace-based review method and reporting
  structure <https://owasp.org/www-project-code-review-guide/>
- **OWASP Top 10 (2021)** — weakness taxonomy used in findings
  <https://owasp.org/Top10/>
- **OWASP ASVS 4.0** — the validate / authorise / encode triad in step 3
  <https://owasp.org/www-project-application-security-verification-standard/>
- **CVSS v3.1 specification** — severity reasoning
  <https://www.first.org/cvss/v3.1/specification-document>
- **CWE** — weakness identifiers cited in findings <https://cwe.mitre.org/>

**Not sourced — written for this framework:** the Node/TypeScript grep patterns
(OWASP is language-agnostic), the money/stock arithmetic step, and the
report-never-fix separation.
