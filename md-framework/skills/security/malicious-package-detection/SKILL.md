---
name: malicious-package-detection
version: 1.0.0
description: |
  Assess whether a package is hostile rather than merely vulnerable —
  typosquatting, dependency confusion, install-script payloads, obfuscated code,
  and hijacked maintainer accounts. Use before adding any new dependency, when
  reviewing a lockfile change, or when asked "is this package safe to install".
  CWE-506.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Malicious Package Detection (CWE-506)

Distinct from `dependency-vulnerabilities`: that skill handles packages with
accidental defects. This one handles packages that are hostile on purpose.

Installing a package runs its code with your privileges, on your machine and in
CI, before any of your tests run. Assess before installing, not after.

### Name and provenance

The cheapest and highest-yield check. Compare the name against the popular
package it resembles:

- **Typosquatting** — `expres`, `lodahs`, `crossenv`, `discordjs` vs `discord.js`.
  Character swaps, omissions, hyphen/dot changes, and singular/plural variants.
- **Dependency confusion** — a public package named identically to your internal
  scoped package. If your registry falls back to the public one, a stranger's
  code wins. Verify scope configuration and registry precedence.
- **Brandjacking** — `@types/`-style or org-lookalike scopes the real project
  does not own.

```bash
npm view <package> repository.url homepage maintainers time.created
npm view <package> dist-tags versions --json | jq '.versions | length'
```

Confirm the repository URL actually exists and its contents match the published
package. A missing, mismatched, or unrelated repository is a strong signal.

### Signals worth stopping on

| Signal | Why it matters |
|---|---|
| Install scripts (`preinstall`/`install`/`postinstall`) | Executes on install, before any review |
| Package created days ago, already many downloads | Consistent with an active campaign |
| Single maintainer, recently added | Possible account takeover |
| Version bump with a large unexplained diff | Classic hijack pattern |
| Obfuscated, minified, or base64 blobs in source | Legitimate libraries ship readable source |
| Network calls at import time | Beaconing or payload fetch |
| Reads env vars, `~/.npmrc`, `~/.ssh`, or cloud metadata | Credential theft |
| Bundled binaries or `.node` files | Unauditable |
| Very few weekly downloads for a "popular" utility | Inconsistent with its claims |

```bash
# Install scripts across the tree
grep -rE '"(pre|post)?install"\s*:' node_modules/*/package.json | head -30
# Suspicious behaviour in a specific package
grep -rnE "child_process|eval\(|Buffer\.from\([^)]*base64|process\.env\[" node_modules/<pkg>/ | head -20
grep -rnE "169\.254\.169\.254|\.npmrc|id_rsa|\.aws/credentials" node_modules/<pkg>/
```

### Assessment procedure

1. Check the name against the package it resembles. Stop here if it is a squat.
2. Verify the repository exists, is active, and matches the published artifact.
3. Check age, download trend, maintainer count, and recent maintainer changes.
4. Inspect `package.json` for install scripts. Any script means read it.
5. Skim the actual source — entry point and anything it requires at import time.
6. Ask whether it is needed at all. A three-line utility with a dependency tree
   is a bad trade.
7. Record a verdict: **approve / approve with pinning / reject**.

### Defensive configuration

```bash
npm config set ignore-scripts true      # then allow-list per package as needed
```

- Use `npm ci` with a committed lockfile so installs are reproducible.
- Pin exact versions for anything security-relevant.
- Scope internal packages and configure the registry so public names cannot
  shadow them.
- Consider a delay policy — avoid versions published within the last few days,
  when hijacks are usually caught.

### If you find one

Treat it as an incident, not a dependency problem: `CRITICAL`, escalate
immediately. Rotate every credential that was present on any machine or CI runner
that installed it — assume exfiltration. Then remove the package and audit the
lockfile history for when it entered.

### Checklist

- [ ] Name compared against lookalikes
- [ ] Repository verified to exist and match
- [ ] Age, downloads, and maintainer history checked
- [ ] Install scripts identified and read
- [ ] Source skimmed for obfuscation, network calls, credential access
- [ ] Necessity questioned
- [ ] Lockfile change explained by a manifest change
- [ ] Verdict recorded

## References

- **OWASP Software Component Verification Standard (SCVS)** — component
  provenance and verification requirements
  <https://owasp.org/www-project-software-component-verification-standard/>
- **CWE-506** — embedded malicious code
  <https://cwe.mitre.org/data/definitions/506.html>
- **Alex Birsan, "Dependency Confusion"** — the internal/public name shadowing
  attack <https://medium.com/@alex.birsan/dependency-confusion-4a5d60fec610>
- **npm documentation — `ignore-scripts`, `npm ci`, scopes and registries**
  <https://docs.npmjs.com/cli/v10/using-npm/config#ignore-scripts>
- **OpenSSF Scorecard** — automated project-health signals
  <https://github.com/ossf/scorecard>

**Not sourced — written for this framework:** the signals table, the detection
commands, the seven-step assessment procedure, and the incident response steps.
