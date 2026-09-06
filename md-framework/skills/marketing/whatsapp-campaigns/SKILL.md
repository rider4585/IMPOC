---
name: whatsapp-campaigns
version: 1.0.0
description: |
  Run WhatsApp outreach compliantly and effectively — opt-in, template messages,
  the service window, frequency, and measurement. Use when planning direct
  messaging to customers, or when asked "can we WhatsApp our customers about
  this".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## WhatsApp Campaigns

WhatsApp reaches customers directly and gets read. That is exactly why it is
tightly governed and why misuse is costly: an account can be restricted or banned
for messaging people who did not ask, and the channel is then gone.

> **Compliance first.** Verify current rules against the WhatsApp Business
> Messaging Policy and your provider before sending anything — platform rules and
> pricing change, and this skill is not a substitute for reading them.

### Opt-in is mandatory and specific

You may only message customers who **explicitly opted in** to receive messages
from this business on WhatsApp.

- Having a customer's phone number from a purchase is **not** opt-in
- Opt-in must be for this business, and the customer must know what they will
  receive
- Record **when, where, and how** consent was obtained — you may need to
  demonstrate it
- Opt-out must be honoured **immediately** and permanently
- Marketing consent is separate from transactional contact consent

```sql
-- The only valid audience
SELECT c.id, c.name, c.phone
FROM customer c
WHERE c.shop_id=$1
  AND c.whatsapp_opt_in = true
  AND c.whatsapp_opted_out_at IS NULL
  AND c.phone IS NOT NULL;
```

**Filter on consent in the query.** Filtering afterwards, or by hand, is how
mistakes happen. If a consent column does not exist, that is the finding —
capture consent before running any campaign.

For India, also observe **TRAI's commercial communication regulations** (DND
registry and consent requirements) — these apply to commercial messaging
generally, and the shop is responsible for compliance regardless of provider.

### Template messages and the service window

| Situation | What you may send |
|---|---|
| Customer messaged you within 24 hours | Free-form replies, within that window |
| Outside that window | **Pre-approved template messages only** |
| Marketing content | Marketing-category template, opt-in required |
| Order updates, receipts | Utility-category template, still needs consent |

Templates require approval before use, and are rejected for being vague,
promotional in a utility category, or misleading. Write them concretely and
truthfully.

Categories are priced differently and are enforced — sending marketing content in
a utility template risks the account.

### Frequency: less than you think

The fastest way to lose this channel is to overuse it. Customers block
businesses that message too often, and blocks damage your quality rating, which
restricts sending.

Practical limits:

- **At most a few marketing messages a month**, and fewer is usually better
- Never more than one in a day
- Prefer **relevant and infrequent** over regular and generic
- Transactional messages (order ready, receipt) do not count toward this and are
  welcomed

Monitor block and report rates. A rising rate is a warning that precedes
restriction — reduce frequency before the platform reduces it for you.

### What works on this channel

It is a personal, one-to-one medium. Messages that read as bulk marketing perform
worst.

| Works | Does not |
|---|---|
| "Your usual rice is back in stock" | "MEGA SALE!! 50% OFF!!" |
| Order ready for collection | Generic weekly newsletter |
| A specific offer on something they buy | Broadcast to everyone |
| Personal reactivation after a gap | Repeated identical messages |
| Answering a question quickly | Anything they did not ask for |

**Relevance is the whole channel.** Use `customer-segmentation` and
`recommendation-generation` to send few, well-targeted messages rather than many
generic ones.

Keep messages short, put the point first, and make the action obvious.

### Cost and the break-even

Each template message costs money. That changes the arithmetic against free
channels.

```
400 messages × ₹0.85          =  ₹340
Expected response rate         =  8%  →  32 purchases
Average basket                 =  ₹420  →  ₹13,440 revenue
Gross margin at 28%            =  ₹3,763
```

But only the **incremental** portion counts — most of those customers may have
come anyway. See `campaign-analysis`. With a control group the true figure is
usually far lower than the gross calculation suggests.

**Compare against free alternatives first.** In-store signage costs nothing and
reaches everyone who is already visiting — see `campaign-planning`.

### Measure properly

```sql
SELECT m.campaign_id,
       count(*)                                              AS sent,
       count(*) FILTER (WHERE m.delivered_at IS NOT NULL)    AS delivered,
       count(*) FILTER (WHERE m.read_at IS NOT NULL)         AS read,
       count(*) FILTER (WHERE m.replied_at IS NOT NULL)      AS replied,
       count(*) FILTER (WHERE m.opted_out_at IS NOT NULL)    AS opted_out
FROM whatsapp_message m WHERE m.campaign_id=$1 GROUP BY 1;
```

**Track opt-outs as a primary metric, not a footnote.** A campaign with good
sales and a high opt-out rate has borrowed from the future — each opt-out is a
customer you can never message again.

Attribute purchases through a control group, not through message opens — see
`campaign-analysis`.

### Data protection

- Phone numbers are personal data; hold them under the shop's retention policy
- Do not export customer lists to third-party tools without a deliberate decision
- Never include another customer's information in a message
- Do not put sensitive detail (health items, financial state) in a message
- Broadcast lists must not expose recipients to each other

See `security-architecture` and `excessive-data-exposure`.

### Before every send

- [ ] Every recipient has recorded, current opt-in
- [ ] Opt-outs excluded in the query
- [ ] Template approved and in the correct category
- [ ] Frequency limit respected per recipient
- [ ] Message is specific and relevant to that recipient
- [ ] Opt-out instruction present
- [ ] Stock available for anything promoted
- [ ] Control group held back for measurement
- [ ] Cost computed and compared against free channels
- [ ] Human approval obtained for the offer and the send

### Checklist

- [ ] Consent captured, dated, and queryable
- [ ] Current platform policy verified before sending
- [ ] Local regulations (e.g. TRAI DND in India) observed
- [ ] Templates approved and correctly categorised
- [ ] Frequency deliberately low
- [ ] Block and opt-out rates monitored as leading indicators
- [ ] Messages personal and specific, not broadcast
- [ ] Incremental effect measured with a control group
- [ ] Free channels considered first
- [ ] Personal data handled per policy
- [ ] Human approval for every send

## References

- **WhatsApp Business Messaging Policy and Commerce Policy** — opt-in
  requirements, template categories, and the 24-hour service window
  <https://business.whatsapp.com/policy>
- **WhatsApp Business Platform documentation — message templates and quality
  rating** <https://developers.facebook.com/docs/whatsapp>
- **TRAI — Telecom Commercial Communications Customer Preference Regulations**
  — consent and DND obligations for commercial messaging in India
  <https://www.trai.gov.in/>
- **Standard direct marketing practice** — control groups and opt-out rate as a
  campaign health metric

**Not sourced — written for this framework:** the works/does-not table, the
frequency guidance, the opt-outs-as-primary-metric rule, the break-even
comparison against free channels, and the pre-send checklist.
