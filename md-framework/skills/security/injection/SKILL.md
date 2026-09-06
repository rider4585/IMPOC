---
name: injection
version: 1.0.0
description: |
  Detect and remediate injection flaws beyond SQL — OS command, path traversal,
  NoSQL, LDAP, header/CRLF, template, and log injection — in Node.js/TypeScript
  applications. Use when reviewing code that passes input to a shell, filesystem,
  external interpreter, or log, or when asked to "check for injection". For SQL
  specifically see sql-injection; for HTML/JS output see xss. CWE-77, CWE-78,
  CWE-22, CWE-117.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Injection (non-SQL)

Every injection is the same bug: data crossing into a context where it is parsed
as instructions. The fix is always the same shape — keep data as data, or
allow-list it.

### OS command injection (CWE-78)

```bash
grep -rnE "(exec|execSync)\(" src/ --include=*.js
grep -rnE "(spawn|spawnSync|execFile)\(.*shell:\s*true" src/ --include=*.js
```

- **Never** build a shell string from input. Prefer `execFile`/`spawn` with an
  argument array and `shell: false` (the default).
- If a shell is genuinely required, allow-list the command and validate each
  argument against a strict pattern. Escaping shell metacharacters is not a
  reliable defence.

```js
// ❌ shell parses the input
exec(`convert ${file} out.png`);
// ✅ arguments never reach a shell
execFile('convert', [file, 'out.png']);
```

### Path traversal (CWE-22)

```bash
grep -rnE "(readFile|writeFile|createReadStream|sendFile|unlink)\(" src/ --include=*.js
```

Input reaching a filesystem path can escape with `../`, absolute paths, symlinks,
or URL/unicode encodings.

```js
const base = path.resolve('/srv/uploads');
const full = path.resolve(base, path.normalize(name));
if (!full.startsWith(base + path.sep)) throw new ForbiddenException();
```

Prefer generating server-side identifiers over accepting client filenames at all.

### NoSQL / query-object injection

A JSON body binding straight into a query lets an attacker submit an *operator*
where a value was expected — `{"password": {"$ne": null}}`. Validate that
incoming values are primitives of the expected type before they reach a query.

### Header and CRLF injection (CWE-113)

Input reflected into a response header, redirect `Location`, or email header can
inject `\r\n` and split the response or forge headers. Strip CR/LF and validate
redirect targets against an allow-list of internal paths.

### Template injection

Never build a template from user input, and never pass user input as a template
*expression*. Pass it as a rendering **value** only.

### Log injection (CWE-117)

Unescaped newlines in logged input let an attacker forge log entries and hide
their tracks — which matters most in exactly the audit trail you rely on for
voids and refunds. Use structured (JSON) logging so input is a field value, never
a line.

### Severity

`CRITICAL` for command injection and for path traversal that reaches write or
arbitrary read. `HIGH` for NoSQL operator injection on an auth path. `MEDIUM` for
log injection, raised when the log is a compliance artifact.

### Checklist

- [ ] No shell string built from input; `shell: true` justified or removed
- [ ] Filesystem paths resolved and confirmed inside the base directory
- [ ] Query inputs validated as primitives of the expected type
- [ ] Redirect targets and reflected headers allow-listed, CR/LF stripped
- [ ] Templates receive input as values, never as source
- [ ] Logging is structured; audit entries cannot be forged
- [ ] Regression test added per finding

## References

- **OWASP OS Command Injection Defense Cheat Sheet** — argument-array approach
  <https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html>
- **OWASP Input Validation Cheat Sheet** — allow-listing and path handling
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
- **CWE-78** (OS command), **CWE-22** (path traversal), **CWE-113** (CRLF),
  **CWE-117** (log injection) <https://cwe.mitre.org/>
- **OWASP Top 10 (2021) A03 Injection** <https://owasp.org/Top10/A03_2021-Injection/>
- **Node.js documentation — `child_process`** — `execFile` versus `exec`
  semantics <https://nodejs.org/api/child_process.html>

**Not sourced — written for this framework:** the Node/TypeScript detection
commands, the path-containment snippet, and the audit-trail rationale for log
injection severity.
