---
name: output-encoding
version: 1.0.0
description: |
  Apply context-correct output encoding when untrusted data is written into HTML,
  attributes, URLs, JavaScript, CSS, JSON, CSV, or SQL identifiers. Use when
  reviewing any code that renders or exports user-controlled data, when asked
  "is this properly encoded", or alongside xss during a secure code review.
  CWE-116, CWE-1236.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Output Encoding (CWE-116)

Encoding is not a single operation. The correct transformation depends entirely
on the context the data lands in, and applying the wrong one leaves the flaw
open while looking addressed.

### Encode by context

| Context | Correct handling | Wrong but common |
|---|---|---|
| HTML text | JSX interpolation, or escape `& < > " '` | HTML-escaping into an attribute without quotes |
| HTML attribute | Quote the attribute **and** escape | Relying on escaping alone |
| URL parameter | `encodeURIComponent()` | HTML escaping |
| URL scheme position | Allow-list `http/https/mailto` | Escaping — `javascript:` survives it |
| JavaScript context | Serialise as JSON data; never build code | String concatenation into a script |
| CSS value | Allow-list; avoid input in CSS entirely | Escaping |
| JSON response | Let the serialiser encode; set `Content-Type` | Manual string building |
| CSV / spreadsheet export | Prefix formula-leading characters | HTML escaping |
| SQL identifier | Allow-list against a fixed set | Quoting |
| Log entry | Structured fields | Interpolating into a message string |

### The rule that prevents most mistakes

**Encode at the point of output, once, for the sink it enters.** Encoding on
input corrupts stored data, breaks when the same value is rendered into a
different context later, and produces double-encoded output that hides bugs.

### CSV injection (CWE-1236)

Specific to any system that exports reports — which every retail system does. A
cell beginning `=`, `+`, `-`, `@`, tab, or CR is interpreted as a formula by
Excel and Sheets, and can exfiltrate data or run commands when a staff member
opens the export.

```js
const csvSafe = (v: string) =>
  /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
```

Product names and customer notes are attacker-influenced and land directly in
exports — treat this as a real finding, not a theoretical one.

### Detection

```bash
grep -rnE "encodeURI\(|escape\(" src/ --include=*.js          # wrong or legacy helpers
grep -rn "dangerouslySetInnerHTML" src/ --include=*.jsx
grep -rnE "(join\(','\)|\.csv|toCsv|writeCsv)" src/ --include=*.js
grep -rnE "res\.(set|header)\(\s*['\"]Content-Type" src/ --include=*.js
```

### Checklist

- [ ] Each output site classified by context before judging its encoding
- [ ] Encoding applied at output, not at input
- [ ] No double encoding
- [ ] Attributes quoted as well as escaped
- [ ] URL scheme positions allow-listed, not escaped
- [ ] CSV/spreadsheet exports neutralise formula-leading characters
- [ ] `Content-Type` set correctly with `nosniff`
- [ ] Logs structured rather than interpolated

## References

- **OWASP Cross Site Scripting Prevention Cheat Sheet** — the context-by-context
  encoding rules
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- **OWASP Injection Prevention Cheat Sheet** — encode-at-output principle
  <https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html>
- **CWE-116** (improper encoding) and **CWE-1236** (formula injection in CSV)
  <https://cwe.mitre.org/data/definitions/1236.html>
- **OWASP CSV Injection** — the formula-leading character set
  <https://owasp.org/www-community/attacks/CSV_Injection>

**Not sourced — written for this framework:** the context table's wrong-column
examples, the TypeScript helpers, the detection commands, and the retail
framing of CSV export risk.
