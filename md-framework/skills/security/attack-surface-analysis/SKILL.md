---
name: attack-surface-analysis
version: 1.0.0
description: |
  Enumerate everything an attacker can reach in a system — endpoints, inputs,
  file uploads, background consumers, dependencies, and admin surfaces — and rank
  them by exposure and privilege. Use when asked "what is our attack surface",
  "what can an attacker reach", before a threat model or penetration test, or when
  assessing the security posture of an unfamiliar system.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Attack Surface Analysis

The attack surface is every point where untrusted data or an untrusted actor
enters the system. You cannot defend what you have not enumerated, and the
surface is always larger than the API documentation suggests.

### Method

1. **Enumerate network entry points.** Every route, including the ones nobody
   documents: health checks, metrics, admin panels, file downloads, webhook
   receivers, GraphQL, WebSocket handlers, and static file serving.
   ```bash
   grep -rnE "\.(get|post|put|patch|delete|all|use)\(" src/ --include=*.js | wc -l
   grep -rnE "@(Get|Post|Put|Patch|Delete|Sse|WebSocketGateway)\(" src/ --include=*.js
   ```

2. **Enumerate non-network entry points.** These are routinely missed:
   file and CSV imports, scheduled jobs processing stored data, message queue
   consumers, email/SMS inbound handlers, and CLI or seed scripts run against
   production.

3. **Classify each by reachability.** Public (unauthenticated) → authenticated →
   role-restricted → internal-only. Verify internal-only claims: network
   segmentation that does not exist is the most common false assumption.

4. **Classify each by privilege and blast radius.** What can this surface reach
   if abused — read data, write data, move money, change stock, alter roles,
   execute code? Rank by the product of reachability and blast radius.

5. **Map the trust boundaries.** Where does data cross from lower to higher
   trust? Those crossings are where controls must sit. See `trust-boundaries`.

6. **Include the supply chain.** Dependencies execute in your process with your
   privileges. Count them, and note any with install scripts or native
   components. See `supply-chain-security`.

7. **Note what is exposed by configuration, not code.** CORS policy, security
   headers, open ports, debug flags, verbose errors, directory listing, and
   source maps in production.

### Output

A ranked table — the ranking is the deliverable, not the list:

```markdown
| Surface | Type | Reachability | Privilege | Blast radius | Rank |
|---|---|---|---|---|---|
| POST /api/auth/login | REST | public | none | credential stuffing → any account | 1 |
| POST /api/imports/products | REST | authenticated | manager | bulk write, parser | 2 |
| queue: stock-adjust | consumer | internal | system | direct stock mutation | 3 |
```

Follow with: unauthenticated surfaces, surfaces lacking rate limits, surfaces
whose "internal-only" status is unverified, and configuration exposures.

### Checklist

- [ ] Every route enumerated from source, not documentation
- [ ] Non-network entry points included (imports, jobs, queues, inbound mail)
- [ ] Reachability verified, not assumed
- [ ] Privilege and blast radius recorded per surface
- [ ] Trust boundaries identified
- [ ] Dependency surface counted
- [ ] Configuration exposures checked
- [ ] Output ranked

## References

- **OWASP Attack Surface Analysis Cheat Sheet** — the enumeration and
  classification method in steps 1–4
  <https://cheatsheetseries.owasp.org/cheatsheets/Attack_Surface_Analysis_Cheat_Sheet.html>
- **Microsoft Threat Modeling / STRIDE guidance** — trust boundary treatment in
  step 5 <https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool>
- **NIST SP 800-115** — enumeration-before-assessment principle
  <https://csrc.nist.gov/pubs/sp/800/115/final>
- **OWASP Top 10 (2021) A05 Security Misconfiguration** — step 7
  <https://owasp.org/Top10/A05_2021-Security_Misconfiguration/>

**Not sourced — written for this framework:** the non-network entry point list in
step 2, the reachability × blast-radius ranking, and the Node/TypeScript greps.
