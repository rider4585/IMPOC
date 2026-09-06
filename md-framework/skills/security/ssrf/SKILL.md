---
name: ssrf
version: 1.0.0
description: |
  Detect and remediate server-side request forgery — the server fetching a URL
  the client controls, reaching internal services and cloud metadata endpoints.
  Use when reviewing webhooks, image or file fetching, URL imports, PDF
  rendering, or any outbound request built from input. OWASP API7:2023,
  CWE-918.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Server-Side Request Forgery (CWE-918)

The server makes an HTTP request to a destination the attacker chooses. The
request originates inside your network, with your credentials and your firewall
position — so it reaches things the attacker cannot reach directly.

The classic target is the cloud instance metadata service at `169.254.169.254`,
which returns temporary IAM credentials. Others: internal admin panels, databases
on private addresses, and other services that trust callers by network location.

### Where it appears

Any feature that fetches a URL supplied or influenced by a user:

- Webhook registration and delivery
- "Import from URL" for products, price lists, or images
- Avatar or logo fetching from a remote address
- PDF/receipt rendering that resolves remote images or stylesheets
- Link preview generation
- Third-party integrations configured with a user-supplied base URL

```bash
grep -rnE "(fetch|axios|got|request|undici)\s*\(" src/ --include=*.js
grep -rnE "\.(get|post)\(\s*(url|req\.body|dto|input|target)" src/ --include=*.js
grep -rnE "(webhookUrl|callbackUrl|imageUrl|redirectUri|endpoint)" src/ --include=*.js
```

### Remediation

**Allow-list destinations.** The only robust control. Where the set of legitimate
destinations is known — a payment provider, a supplier feed — permit exactly
those hosts and nothing else.

**Where an allow-list is impossible, validate hard:**

1. Parse the URL and require scheme `http` or `https`. Reject `file:`, `gopher:`,
   `ftp:`, `data:`.
2. **Resolve DNS, then check the resolved IP** against a blocklist — not the
   hostname. A hostname check is defeated by a name resolving to `127.0.0.1`.
3. Block private and special ranges: `0.0.0.0/8`, `10/8`, `100.64/10`,
   `127/8`, `169.254/16` (metadata), `172.16/12`, `192.168/16`, `224/3`, plus
   IPv6 `::1`, `fc00::/7`, `fe80::/10`, and IPv4-mapped forms.
4. **Do not follow redirects**, or re-validate the destination at every hop. A
   permitted URL redirecting to `169.254.169.254` defeats a single up-front check.
5. Guard against DNS rebinding: resolve once, then connect to that pinned
   address rather than re-resolving.

```js
const ip = (await dns.lookup(new URL(target).hostname)).address;
if (BLOCKED.check(ip)) throw new BadRequestException('destination not allowed');
```

**Reduce the impact:**
- Fetch from an egress-restricted network segment or proxy.
- Never return the raw upstream response body to the client — that turns blind
  SSRF into full read access.
- Enforce timeouts and response size limits.
- Require IMDSv2 (token-based) on cloud instances so a simple GET cannot retrieve
  credentials.

### Severity

`CRITICAL` where cloud metadata or an internal admin surface is reachable, or
where the response is returned to the client. `HIGH` for blind SSRF reaching
internal hosts. Blind variants are still serious — port scanning and internal
state changes do not need a response body.

### Checklist

- [ ] Every outbound request built from input identified
- [ ] Destinations allow-listed where the set is knowable
- [ ] Scheme restricted to http/https
- [ ] Validation on the **resolved IP**, not the hostname
- [ ] Private, loopback, and link-local ranges blocked (IPv4 and IPv6)
- [ ] Redirects blocked or re-validated per hop
- [ ] Connection pinned to the validated address
- [ ] Upstream response not echoed to the client
- [ ] Timeouts and size limits enforced

## References

- **OWASP Server Side Request Forgery Prevention Cheat Sheet** — allow-listing,
  IP validation, redirect handling
  <https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html>
- **OWASP API Security Top 10 (2023) — API7 Server Side Request Forgery**
  <https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/>
- **OWASP Top 10 (2021) A10 SSRF** <https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/>
- **CWE-918** <https://cwe.mitre.org/data/definitions/918.html>
- **AWS documentation — IMDSv2** — token-requiring metadata service
  <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html>

**Not sourced — written for this framework:** the retail feature list, the
detection commands, and the Node `dns.lookup` pinning snippet.
