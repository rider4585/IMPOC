---
name: supply-chain-security
version: 1.0.0
description: |
  Secure the path from source to running system — build integrity, CI/CD trust,
  artifact provenance, lockfile discipline, and SBOM. Use when reviewing CI
  pipelines, build configuration, release process, or when asked "is our build
  pipeline secure". OWASP A08:2021, CWE-1357.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Software Supply Chain Security (A08:2021)

Everything between a developer's keystroke and running production code is attack
surface. An attacker who compromises the build does not need a vulnerability in
your application — they add their own.

Scope here is the **pipeline**. Package trust is `malicious-package-detection`;
known CVEs are `dependency-vulnerabilities`.

### Source integrity

- Protected branches; no direct pushes to the release branch.
- Required review — and verify the settings actually enforce it rather than
  merely suggesting it.
- Signed commits or tags for releases where the provenance matters.
- Restrict who can change CI configuration. In most repositories, anyone who can
  edit the workflow file can execute arbitrary code with the pipeline's secrets —
  that is usually a wider group than people realise.

### Build and CI trust

```bash
cat .github/workflows/*.yml 2>/dev/null | grep -nE "uses:|run:|secrets\.|permissions:"
```

| Risk | Control |
|---|---|
| Third-party actions pinned by tag | Pin to a full commit SHA — tags are mutable |
| Excessive token permissions | Set `permissions:` least-privilege per job |
| Secrets exposed to fork PRs | Never run privileged jobs on `pull_request_target` with checkout of the fork |
| Secrets echoed in logs | No `set -x`; mask values; never print env |
| Untrusted input into `run:` | PR titles and branch names can inject shell — quote and use env, not interpolation |
| Self-hosted runners shared across repos | Isolate; ephemeral runners for public repos |
| Build fetching unpinned remote scripts | `curl \| bash` in a build is arbitrary code from a third party |

### Reproducibility

- Commit the lockfile; use `npm ci`, never `npm install`, in CI.
- Pin base images by digest, not by tag — `node:20` moves; `node@sha256:…` does
  not.
- Fail the build on unexpected lockfile changes.
- Same commit should produce the same artifact; if it does not, you cannot verify
  what shipped.

### Artifact and deployment integrity

- Sign artifacts and images; verify signatures at deploy time. An unverified
  artifact is trusted by convention alone.
- Restrict who and what can deploy to production; require a reviewed pipeline
  path rather than a local push.
- Keep an auditable record of which commit produced which running version.

### SBOM

Generate a software bill of materials per release so that when a CVE lands you
can answer "are we affected, and where" in minutes rather than days.

```bash
npm sbom --sbom-format cyclonedx > sbom.json
```

Store it with the release artifact, not just in CI logs.

### Developer environment

Often the weakest link and rarely reviewed:
- `ignore-scripts` enabled by default; allow-list where genuinely needed.
- Editor extensions and CLI tools are also dependencies with the same privileges.
- Credentials in `~/.npmrc` and `~/.aws` are exactly what a hostile install script
  targets.

### Severity

`CRITICAL` for a pipeline path that lets an unreviewed change reach production,
or secrets reachable by fork pull requests. `HIGH` for unpinned third-party
actions, mutable base images, and unsigned deployments. `MEDIUM` for a missing
SBOM.

### Checklist

- [ ] Release branch protected; review enforced, not merely configured
- [ ] Workflow file changes restricted
- [ ] Third-party actions pinned to commit SHAs
- [ ] CI token permissions least-privilege
- [ ] Fork pull requests cannot reach secrets
- [ ] No untrusted interpolation into shell steps
- [ ] Lockfile committed; `npm ci` in CI
- [ ] Base images pinned by digest
- [ ] Artifacts signed and verified at deploy
- [ ] SBOM generated per release
- [ ] Install scripts disabled by default locally

## References

- **OWASP Top 10 (2021) A08 Software and Data Integrity Failures**
  <https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/>
- **SLSA framework (v1.0)** — build provenance and integrity levels
  <https://slsa.dev/spec/v1.0/levels>
- **NIST SP 800-218, Secure Software Development Framework (SSDF)** — pipeline
  practices <https://csrc.nist.gov/pubs/sp/800/218/final>
- **OWASP Software Component Verification Standard (SCVS)** — SBOM and provenance
  <https://owasp.org/www-project-software-component-verification-standard/>
- **CycloneDX specification** — SBOM format <https://cyclonedx.org/specification/overview/>
- **GitHub Actions — Security hardening for GitHub Actions** — SHA pinning,
  `permissions`, `pull_request_target` risks
  <https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions>

**Not sourced — written for this framework:** the CI risk table, the developer
environment section, and the severity mapping.
