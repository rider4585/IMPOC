---
name: stride
version: 1.0.0
description: |
  Apply the STRIDE taxonomy — Spoofing, Tampering, Repudiation, Information
  disclosure, Denial of service, Elevation of privilege — to enumerate threats
  systematically per element of a data flow. Use during threat modeling, when
  asked "what could go wrong here", or to structure a security design review.
  Run trust-boundaries first.
allowed-tools:
  - Read
  - Grep
  - Glob
---

## STRIDE

A classification that makes threat enumeration systematic instead of
imaginative. Walk every element, apply all six categories, and you find the
threats you would not have thought of unprompted.

**Prerequisite:** a data flow with trust boundaries marked. See
`trust-boundaries`.

### The six categories

| | Threat | Violates | Ask |
|---|---|---|---|
| **S** | Spoofing | Authentication | Can someone claim to be another user, service, or device? |
| **T** | Tampering | Integrity | Can data be modified in transit, at rest, or in memory? |
| **R** | Repudiation | Non-repudiation | Can someone deny having done it? Is there an attributable record? |
| **I** | Information disclosure | Confidentiality | Can someone read what they should not? |
| **D** | Denial of service | Availability | Can someone make it unavailable or unusably slow? |
| **E** | Elevation of privilege | Authorisation | Can someone gain rights they were not granted? |

### Which categories apply to which element

Applying all six to everything wastes effort. Standard mapping:

| Element | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| External entity (user, third party) | ✅ | | ✅ | | | |
| Process (service, handler, job) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Data store (database, cache, files) | | ✅ | ✅ | ✅ | ✅ | |
| Data flow (request, message, query) | | ✅ | | ✅ | ✅ | |

### Retail and POS worked examples

The threats that actually materialise in a system like this:

| Cat | Threat | Control |
|---|---|---|
| S | Cashier uses a colleague's PIN to authorise a discount | Per-user credentials, no shared logins, MFA for overrides |
| T | Client submits a modified `unitPrice` in the cart payload | Price resolved server-side from the catalogue, never trusted from the request |
| R | Manager voids a sale and denies it | Immutable, attributable audit log with timestamp and actor |
| I | Cashier reads another shop's sales by changing an id | Object-level authorisation scoped in the query |
| D | Unbounded report export exhausts the database | Pagination caps, query timeouts, per-user rate limits |
| E | Mass assignment sets `role: owner` on profile update | Allow-listed write fields; role set server-side only |

**Repudiation deserves particular weight here.** Voids, refunds, discount
overrides, price changes, and stock adjustments must each be attributable to a
person. An unlogged override is a STRIDE-R finding, and it is the threat most
often missed because nothing appears broken.

### Method

1. Take the data flow with boundaries marked.
2. For each element, apply the categories its row permits.
3. For each threat, state a concrete scenario — who, doing what, achieving what.
   A category name alone is not a threat.
4. Rate likelihood × impact using the shared severity scale.
5. Name a required control for every threat. A threat without a control is an
   unfinished analysis.
6. Record accepted risks explicitly, with who accepted them.

### Output

```markdown
| # | Element | Cat | Threat scenario | Likelihood | Impact | Severity | Required control |
|---|---------|-----|-----------------|------------|--------|----------|------------------|
| 1 | POST /sales | T | Client sends unitPrice lower than catalogue | High | High | HIGH | Resolve price server-side |
| 2 | sales table | R | Void with no actor recorded | Medium | High | HIGH | Append-only audit with actor + reason |
```

### Checklist

- [ ] Data flow and trust boundaries established first
- [ ] Every element walked; applicable categories all considered
- [ ] No category skipped without a stated reason
- [ ] Each threat expressed as a concrete scenario, not a label
- [ ] Insider/authenticated adversary modelled, not only anonymous attackers
- [ ] Repudiation checked on every money and stock operation
- [ ] Every threat paired with a required control
- [ ] Accepted risks named with an owner
- [ ] Abuse cases handed to QA for testing

## References

- **Microsoft — STRIDE threat model** — the six categories and element mapping
  <https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats>
- **Adam Shostack, _Threat Modeling: Designing for Security_** — per-element
  application and the "threat needs a scenario" discipline
- **OWASP Threat Modeling Cheat Sheet**
  <https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html>
- **CVSS v3.1** — likelihood/impact rating consistency
  <https://www.first.org/cvss/v3.1/specification-document>

**Not sourced — written for this framework:** the retail/POS worked examples, the
emphasis on repudiation for voids and overrides, and the output table format.
