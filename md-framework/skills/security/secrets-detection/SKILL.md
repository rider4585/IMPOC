---
name: secrets-detection
version: 1.0.0
description: |
  Find credentials committed to a repository or leaked through logs, errors,
  bundles, and CI output — API keys, tokens, passwords, connection strings,
  private keys. Use when reviewing any diff, before any commit, when asked "check
  for secrets", or when onboarding onto an unfamiliar repository. CWE-798,
  CWE-532.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Secrets Detection (CWE-798)

A committed credential is `CRITICAL` on discovery, independent of everything else
in the change. Git history is permanent and widely mirrored — treat any exposed
secret as compromised from the moment it was written.

### Scan the diff and the history

```bash
# High-signal assignments
grep -rnEi "(api[_-]?key|secret|passwd|password|token|bearer|credential)\s*[:=]\s*['\"][^'\"]{8,}" \
  --include=*.json --include=*.env* .
# Private keys and certificates
grep -rn "BEGIN \(RSA \|EC \|OPENSSH \|PGP \)\?PRIVATE KEY" .
# Connection strings with inline credentials
grep -rnE "(postgres|postgresql|mysql|mongodb|redis|amqp)://[^:]+:[^@]+@" .
# Known provider prefixes
grep -rnE "\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|xox[baprs]-|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})" .
# Files that should never be committed
git ls-files | grep -Ei "\.env$|\.env\.(local|prod)|\.pem$|\.p12$|\.pfx$|id_rsa|credentials\.json|serviceAccount.*\.json"
```

For history rather than the working tree:
```bash
git log -p --all -S 'BEGIN PRIVATE KEY' --oneline
```

Use a dedicated scanner (`gitleaks`, `trufflehog`) for depth — these greps are
for the review pass, not a substitute for tooling in CI.

### The non-obvious leak paths

Reviewing source alone misses most of these:

| Path | What leaks |
|---|---|
| Log statements | Tokens logged with the whole request object |
| Error responses | Connection strings inside database error messages |
| Frontend bundles | Any key in a `VITE_*`/`NEXT_PUBLIC_*` variable ships to the browser |
| Source maps in production | Original source including inlined constants |
| Test fixtures and seeds | Real credentials used "temporarily" |
| CI logs | Echoed variables, `set -x` output |
| Docker images | `ENV` layers and build args persist in the image |
| Committed `.env.example` | Sometimes copied from a real `.env` |
| Screenshots and docs | Tokens visible in pasted output |

```bash
grep -rnE "console\.(log|error)\(.*(req|token|secret|password|key)" src/ --include=*.js
grep -rnE "(VITE_|NEXT_PUBLIC_|REACT_APP_)[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)" . --include=*.env*
```

The frontend-prefix check is worth running every time — a "public" prefix on a
secret is a common and total exposure.

### Remediation — order matters

1. **Rotate first.** Revoke and reissue the credential before anything else.
   Removing it from the repository does not un-leak it.
2. **Audit for use.** Check provider logs for activity with that credential.
3. **Purge history** only after rotation (`git filter-repo`, or BFG), then force
   push and require everyone to re-clone. Treat purging as damage limitation, not
   remediation.
4. **Move to a proper store** — environment variables injected at runtime, or a
   secret manager. Not a committed config file.
5. **Add a pre-commit hook and CI scanner** so the next one is caught before it
   lands.

### Prevention

- `.env` in `.gitignore`; commit only `.env.example` with placeholder values.
- Never log whole request or config objects — log named fields.
- Redact known key shapes in the logger itself, as a backstop.
- Keep secrets out of frontend-exposed variables entirely; if the browser needs
  it, it is not a secret.

### Checklist

- [ ] Diff scanned for credential-shaped literals
- [ ] No private keys, certificates, or `.env` files tracked
- [ ] No connection strings with inline credentials
- [ ] Frontend-exposed variables contain no secrets
- [ ] Logs and error paths do not emit tokens or config objects
- [ ] Test fixtures use fake values
- [ ] Any found secret rotated **before** history is rewritten
- [ ] CI secret scanning enabled

## References

- **OWASP Secrets Management Cheat Sheet** — storage, rotation, and leak paths
  <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>
- **CWE-798** (hard-coded credentials), **CWE-532** (information exposure through
  log files) <https://cwe.mitre.org/data/definitions/798.html>
- **OWASP Top 10 (2021) A02 Cryptographic Failures**
  <https://owasp.org/Top10/A02_2021-Cryptographic_Failures/>
- **git-filter-repo documentation** — history rewriting procedure
  <https://github.com/newren/git-filter-repo>
- **gitleaks** — CI secret scanning <https://github.com/gitleaks/gitleaks>

**Not sourced — written for this framework:** the grep set, the leak-path table,
and the rotate-before-purge ordering rule.
