---
name: dependency-vulnerabilities
version: 1.0.0
description: |
  Audit third-party dependencies for known vulnerabilities, judge reachability,
  and prioritise remediation. Use when reviewing any dependency change, on a
  scheduled audit, when asked "check our dependencies" or "are we affected by
  this CVE". OWASP A06:2021, CWE-1035, CWE-1104.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Vulnerable and Outdated Components (A06:2021)

Most code shipping to production was written by strangers. This skill decides
which of their known defects actually matter to you.

### Scan the resolved tree, not the manifest

Transitive dependencies are where vulnerabilities live, and the manifest does not
list them.

```bash
npm audit --json | jq '{critical:.metadata.vulnerabilities.critical,
                        high:.metadata.vulnerabilities.high,
                        moderate:.metadata.vulnerabilities.moderate}'
npm audit --audit-level=high
npm outdated
# Why is this package here at all?
npm ls <package>
```

`npm ls` is the most useful command in the set — it tells you which direct
dependency pulled in the vulnerable one, which is who you actually have to
upgrade.

### Reachability decides priority

A CVE in code your application never executes is a lower priority than one in the
request path. Judge it, and state the judgement — this is what separates a useful
report from an ignored one.

1. Identify the vulnerable **function or feature**, not just the package.
2. Determine whether your code reaches it — directly, or through the dependency
   that pulled it in.
3. Classify: **reachable** / **not reachable** / **unknown**.
4. Consider whether the vulnerable path takes attacker-controlled input. A parser
   flaw only matters if untrusted data reaches the parser.

```bash
grep -rn "from '<package>'\|require('<package>')" src/ --include=*.js
```

Never dismiss a CVE as unreachable without doing this trace — an assumed
reachability judgement is worse than no judgement.

### Prioritisation

| Reachable | Severity | Action |
|---|---|---|
| Yes | Critical/High | Fix now; blocks the merge |
| Yes | Moderate | Fix this cycle |
| No | Critical/High | Schedule; document the reasoning |
| No | Moderate/Low | Log to the debt register |
| Unknown | Any | Treat as reachable until proven otherwise |

Dev-only dependencies still matter — they execute on developer machines and in
CI, which hold credentials.

### Remediation

- Prefer the minimum version bump that resolves it.
- Where the fix is in a transitive dependency, upgrade the direct parent; use
  `overrides` only as a temporary measure, and record it as debt.
- **Removal beats patching.** A dependency wrapping a small amount of standard
  library is a liability, not a convenience. Say so when you see one.
- If no fix exists: assess whether the feature can be disabled, the input
  constrained, or the package replaced. Document the accepted risk with an owner.

### Hygiene

- Commit the lockfile; use `npm ci` in CI so builds are reproducible.
- Pin exact versions for anything security-relevant; ranges resolve differently
  between installs.
- Automate scanning in CI so this is continuous rather than occasional.
- Re-audit after every install — a transitive tree can change without any
  manifest edit.

### Output

```markdown
| Package | Version | CVE | Severity | Reachable | Introduced by | Fix | Priority |
|---|---|---|---|---|---|---|---|
| lodash | 4.17.15 | CVE-2021-23337 | High | yes — `template()` in report gen | direct | 4.17.21 | now |
| minimist | 1.2.0 | CVE-2021-44906 | Critical | no — build-time only | via `mkdirp` | 1.2.6 | scheduled |
```

### Checklist

- [ ] Resolved lockfile audited, not just the manifest
- [ ] Each finding traced for reachability, not assumed
- [ ] Introducing parent identified for transitive issues
- [ ] Dev dependencies included in the assessment
- [ ] Fix versions identified
- [ ] Unfixable issues have a documented, owned accepted risk
- [ ] Lockfile committed; CI uses `npm ci`
- [ ] Automated scanning enabled

## References

- **OWASP Top 10 (2021) A06 Vulnerable and Outdated Components**
  <https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/>
- **OWASP Dependency-Check / Vulnerable Dependency Management Cheat Sheet**
  <https://cheatsheetseries.owasp.org/cheatsheets/Vulnerable_Dependency_Management_Cheat_Sheet.html>
- **CWE-1035**, **CWE-1104** (use of unmaintained third-party components)
  <https://cwe.mitre.org/data/definitions/1104.html>
- **npm documentation — `npm audit`, `npm ci`, `overrides`**
  <https://docs.npmjs.com/cli/v10/commands/npm-audit>
- **NIST National Vulnerability Database** — CVE and CVSS source
  <https://nvd.nist.gov/>

**Not sourced — written for this framework:** the reachability classification
procedure, the prioritisation matrix, and the removal-beats-patching guidance.
