---
name: security-verification
version: 1.0.0
description: |
  Independently confirm that a security fix actually closes the reported
  vulnerability, does not merely mask it, and introduces no regression. Use when
  a fix has been submitted for a security finding, when asked to "verify this
  fix", "is this actually fixed", or "close this finding". Must be run by someone
  other than the author of the fix.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Security Fix Verification

A finding is closed when someone who did not write the fix has confirmed the
original attack path no longer works. Self-verification is how vulnerabilities
get marked resolved while remaining exploitable.

### Hard rule

**You may not verify a fix you authored or specified in detail.** If you wrote
it, route verification elsewhere and say why.

### Method

1. **Re-read the original finding first.** Work from the recorded attack path,
   not from the fix description. A fix description tells you what the author
   *believed* they addressed.

2. **Reproduce the original path against the new code.** Walk the exact
   `entry → transform → sink` chain from the finding. Confirm at which hop it now
   fails, and cite that line. "The code looks fixed" is not verification.

3. **Distinguish a fix from a mask.** These are the common false fixes:

   | Mask | Why it fails |
   |---|---|
   | Client-side validation added | Bypassed by direct API call |
   | Input escaped rather than parameterised | Escaping misses encodings and contexts |
   | Error message made generic | Behaviour still differs; oracle remains |
   | Route removed from the UI | Endpoint still reachable |
   | Check added at one call site | Other call sites still vulnerable |
   | Denylist of bad values | Trivially evaded; only allow-lists hold |

4. **Find the other call sites.** A fix applied at one location while the same
   sink is reachable from three others is not a fix. Search for the sink, not the
   patch.
   ```bash
   grep -rn "<the vulnerable function or query>" src/ --include=*.js
   ```

5. **Verify the control sits at the right layer.** Server-side, before the
   effect, and unavoidable by any caller. A control in a route guard that the
   service can be reached around has not closed the path.

6. **Check for regression.** Confirm the fix did not disable legitimate
   behaviour, and did not introduce a new finding — an authorisation check added
   with a wrong scope can leak differently.

7. **Confirm a test exists.** A security fix without a regression test will be
   reintroduced. If none exists, the finding stays open pending one.

### Verdict

Exactly one of:

- **VERIFIED** — original path fails, cited at file:line; all call sites covered;
  regression test present.
- **INSUFFICIENT** — path still reachable, or reachable by a variant. State the
  surviving path precisely.
- **REGRESSION** — original issue closed but a new finding introduced. Report it
  as a new finding with its own severity.

Never issue a partial or conditional verification. If it is not closed, it is
open.

### Checklist

- [ ] I did not author this fix
- [ ] Original finding re-read, not just the fix note
- [ ] Original attack path walked against new code, failure point cited
- [ ] Fix is a real control, not one of the masks above
- [ ] All call sites of the sink checked, not only the patched one
- [ ] Control is server-side and unavoidable
- [ ] No regression, no new finding
- [ ] Regression test exists
- [ ] Verdict recorded

## References

- **OWASP ASVS 4.0** — verification-requirement framing: a control is verified
  against a requirement, not against an intention
  <https://owasp.org/www-project-application-security-verification-standard/>
- **OWASP Web Security Testing Guide (WSTG) v4.2** — retest methodology, §4
  <https://owasp.org/www-project-web-security-testing-guide/>
- **NIST SP 800-115, §5 (Post-Testing / remediation validation)** — independent
  retest principle <https://csrc.nist.gov/pubs/sp/800/115/final>

**Not sourced — written for this framework:** the fix-versus-mask table, the
separation-of-duties rule against self-verification, and the three-verdict
convention.
