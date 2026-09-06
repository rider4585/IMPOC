---
name: trust-boundaries
version: 1.0.0
description: |
  Identify where data or control crosses from lower to higher trust, and verify
  that a control sits at each crossing. Use when threat modeling, when designing
  where validation and authorisation belong, or when asked "where should this
  check live". Prerequisite for threat-modeling and stride.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Trust Boundaries

A trust boundary is any point where data or a request moves from a less trusted
zone into a more trusted one. Vulnerabilities concentrate at these crossings,
because that is where an assumption changes without anything enforcing it.

Getting boundaries right answers the question engineers argue about most: *where
should this check go?*

### Identifying boundaries

Ask: on each side of this line, what am I assuming about the data?

Common crossings in a web application:

| Crossing | Lower trust | Control required |
|---|---|---|
| Browser → API | Everything from the client, including headers | Validate, authenticate, authorise |
| API → database | Query construction | Parameterise |
| API → shell / filesystem | Command and path building | Argument arrays, path containment |
| API → third-party service | Outbound URL and payload | Destination allow-list |
| Third-party → API | Webhooks, callbacks, imports | Signature verification, validate as untrusted |
| Queue → consumer | Message payload | Validate; a queue is not a trust upgrade |
| Database → application | Data written earlier, possibly unvalidated | Encode at output |
| Server → browser | Rendered response | Context-correct encoding |
| Tenant → tenant | Any shared table or cache | Scope enforcement |
| Role → role | Privilege elevation within one session | Re-authorise per operation |

### The rules that follow

1. **Validate on the trusted side of the boundary.** A check performed by the
   client is on the wrong side and is not a control.

2. **Data does not become trusted by being stored.** Input that entered
   unvalidated is still untrusted when read back. This is exactly how stored XSS
   works — the boundary is crossed again on output.

3. **Internal is not trusted.** A service reachable only from the private network
   is one SSRF or one compromised dependency away from being reachable by an
   attacker. Authenticate service-to-service calls.

4. **A queue is not a sanitiser.** Messages carry whatever the producer put in
   them. Consumers validate.

5. **The tenant boundary is a trust boundary.** In a multi-shop system, another
   shop is a different trust zone even though both are authenticated customers.

6. **Place the control at the innermost boundary that owns the risk.** Route
   guards are bypassed by internal callers; query-level scoping is not. Prefer
   the layer closest to the data.

### Mapping them

For a feature under review:

1. Draw the data flow: entities, processes, stores, and the flows between them.
2. Draw a line wherever trust changes.
3. For every flow crossing a line, name the control present — or record its
   absence as a finding.
4. Feed the result into `stride`, applying threat categories per crossing.

```markdown
| # | Crossing | Data | Control present | Location | Gap |
|---|---|---|---|---|---|
| 1 | Browser → POST /api/sales | sale payload | zod schema + role guard | `dto.ts:9` | no object check on productId |
| 2 | API → PostgreSQL | query | parameterised | `sale.repo.ts:44` | — |
| 3 | Supplier webhook → API | price feed | none | `webhook.ts:12` | **unsigned, unvalidated** |
```

The gap column is the output. Everything else is scaffolding for it.

### Checklist

- [ ] Every external entity and data store identified
- [ ] A line drawn wherever trust changes
- [ ] Every crossing has a named control, or a recorded gap
- [ ] Controls sit on the trusted side
- [ ] Stored data re-validated or encoded on read
- [ ] Service-to-service calls authenticated
- [ ] Queue consumers validate payloads
- [ ] Tenant separation treated as a boundary
- [ ] Result handed to `stride` for threat enumeration

## References

- **Microsoft Threat Modeling / STRIDE guidance** — trust boundaries in data flow
  diagrams
  <https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-getting-started>
- **Adam Shostack, _Threat Modeling: Designing for Security_** — boundary
  identification method
- **OWASP Threat Modeling Cheat Sheet**
  <https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html>
- **OWASP Attack Surface Analysis Cheat Sheet**
  <https://cheatsheetseries.owasp.org/cheatsheets/Attack_Surface_Analysis_Cheat_Sheet.html>

**Not sourced — written for this framework:** the crossings table, the six rules,
the tenant-boundary treatment, and the gap-table output format.
