# IMPOC — Customer Communication & Campaign Platform (R-62)

Design for the module that sends every customer-facing message: invoices, birthday
wishes and offers, stock-availability alerts, festival campaigns. Planned 2026-09-14.
Ticket epic: **R-62** (`context/tasks.json`), sub-tickets R-62a … R-62n.

The one-line rule: **business code never talks to a provider.** Sales, birthdays,
stock intake and campaigns all hand a *message request* to the Communication module.
The module renders the template, picks the provider for that channel, sends (or
hands off), logs the result, and shows the history.

---

## 1. Decisions taken (user, 2026-09-14)

| Question | Decision |
|---|---|
| Ticket layout | One epic **R-62** with lettered sub-tickets. **R-47** (receipt delivery) is folded into R-62e. **R-46** is narrowed to Instagram publishing only; its WhatsApp part lives in R-62. |
| First channels | **WhatsApp via `wa.me` and Email, together.** SMS later. |
| WhatsApp in phase 1 | `wa.me` click-to-chat. The system builds the message; staff taps **Open WhatsApp** and presses send in WhatsApp. This is a *hand-off* provider — see §4. The official Cloud API provider replaces it later by config only. |
| Invoice at checkout | **Auto** for every channel the customer consented to and has contact details for. Email sends itself; WhatsApp shows the **Open WhatsApp** hand-off right on the POS screen. |
| Public URL | **None.** The Windows shop laptop stays on the LAN (it has internet *out*, nothing comes *in*). So: no links in messages, no provider webhooks. Email carries the receipt inline. WhatsApp/SMS carry text only. Delivery status stops at *sent* / *handed off* (no *delivered* / *read*) until a public URL exists. |

Consequences of "no public URL": no tokenised `/receipt/:token` page for now, no
email unsubscribe link (opt-out is recorded by staff), no WhatsApp/SMS status webhooks.
All three are listed under *Later* so they can be added without redesign.

## 2. What already exists (reuse, do not rebuild)

- `customers`: `name, phone, email, dob, consent_whatsapp, consent_email, consent_sms, consent_whatsapp_group, consent_recorded_at`.
- `delivery_logs` (+ `delivery` module, `delivery.view` / `delivery.create`): the send ledger — `entity_type, entity_id, channel, status, receipt_payload, provider, provider_message_id, sent_at, delivered_at, failed_at, notes`. **We extend this table** rather than adding a second ledger.
- Receipt renderer: `receipts.service.js` → `buildReceipt` (digital JSON payload), `buildReceiptText`, `buildReceiptHtml` (branded, self-contained HTML). `pdfkit` is already a dependency.
- `app_settings` (`app-settings.service.js`) for shop-wide config; `branding` for shop name/logo (`getShopName()`).
- Idempotency: sales/rentals carry `requestUuid`; `request_keys` table.
- Permissions seeding pattern: `database/migrations/20260905000008-seed-delivery-permissions.js`.
- Frontend: DataGrid, Dialog, Select, Input primitives; `FlatPicklistManager`; `useBranding()`; `apiClient`; `platform/routes.js`.

## 3. Data model (new + changed)

All money is BIGINT paise; all tables get `uuid`, `created_at`, `updated_at`, soft-delete `deleted_at` where rows are user-managed. Migrations use the ESM export style.

### 3.1 `comm_templates`
| column | notes |
|---|---|
| `key` (unique, slug) | e.g. `invoice`, `birthday_wish`, `birthday_offer`, `stock_available`, `festival_offer`. System templates are seeded and cannot be deleted, only edited/deactivated. |
| `name`, `category` | category ∈ `TRANSACTIONAL, MARKETING, RELATIONSHIP, SERVICE`. |
| `channel` | `EMAIL, WHATSAPP, SMS`. One row per (key, channel). |
| `subject` | email only. |
| `body` | text with `{{variables}}`. Email body is HTML-capable; WhatsApp/SMS plain text. |
| `variables` (JSONB) | declared variable names + sample values, used by Preview. |
| `is_active`, `is_system`, `archived_at`, `version` | activate/deactivate, archive; version bumps on edit so a sent message can say which version it used. |

### 3.2 `delivery_logs` — extended (migration adds columns, keeps existing ones)
| new column | notes |
|---|---|
| `customer_id` (FK, nullable) | who it went to. `entity_type` gains values `CUSTOMER`, `CAMPAIGN`, `INQUIRY` next to `SALE/RENTAL`. |
| `template_key`, `template_version` | which template rendered it. |
| `category` | copied from the template (for opt-out + analytics). |
| `campaign_id`, `campaign_step_id`, `variant_key` (nullable) | campaign lineage; `variant_key` is the A/B hook (single variant `A` for now). |
| `recipient` | the actual address used (email / E.164 phone). |
| `rendered_subject`, `rendered_body` | exactly what was sent (audit + resend). |
| `scheduled_for` | when it should go out; `NULL` = now. |
| `attempts`, `last_error`, `next_attempt_at` | retry bookkeeping. |
| `handoff_url` | for hand-off providers (the `wa.me` link). |
| `dedupe_key` (unique, nullable) | e.g. `invoice:SALE:<uuid>:EMAIL`, `birthday_wish:<customer>:2026:WHATSAPP`. Stops double sends. |
| `handed_off_at`, `confirmed_by_user_id` | hand-off audit. |

`status` values: `QUEUED → SENDING → SENT | FAILED`, plus `HANDOFF` (waiting for a human tap), `SKIPPED` (no consent / no contact / opted out), `CANCELLED` (campaign cancelled), and later `DELIVERED`, `READ`.

Indexes: `(status, scheduled_for)`, `(customer_id, created_at)`, `(campaign_id)`, unique `(dedupe_key)`.

### 3.3 `comm_campaigns`, `comm_campaign_steps`
- Campaign: `name, category, template_key, audience` (JSONB segment definition), `channels` (array), `status` ∈ `DRAFT, SCHEDULED, RUNNING, PAUSED, DONE, CANCELLED`, `variants` (JSONB, default `[{key:'A', template_key, weight:100}]`), `cloned_from_id`.
- Step: `campaign_id, label` ("15 days before"), `send_at`, `status` (`PENDING, MATERIALISED, DONE, CANCELLED`), `materialised_at`, counts.

### 3.4 `customer_enquiries` (built in R-63)
`customer_id, product_type_id, colour_id (null), size_id (null), description, notes, promised_date, status` ∈ `OPEN, CLOSED`, `closed_reason` ∈ `NOTIFIED, NOT_NOTIFIED`, `notified_at, notified_channels, closed_note, closed_by_user_id, created_by_user_id`.

### 3.5 `customers` — added columns
`preferred_channel` (nullable `EMAIL|WHATSAPP|SMS`), `marketing_opt_out_at`, `do_not_contact` (bool). Consent says *may we*; opt-out says *stop marketing*; do-not-contact blocks everything except nothing (used for complaints).

### 3.6 Config (`app_settings` keys, prefix `comm.`)
`comm.enabled`, `comm.timezone` (`Asia/Kolkata`), `comm.send_hour` (10), `comm.birthday.enabled`, `comm.birthday.days_before` (7), `comm.birthday.offer_validity_days` (14), `comm.birthday.offer_text`, `comm.birthday.channels`, `comm.email.from_name`, `comm.email.reply_to`, `comm.whatsapp.default_country_code` (`91`).
Secrets (SMTP host/user/pass, future API keys) live in `backend/.env`, never in the DB.

## 4. Provider layer

```
src/modules/comm/
  comm.routes.js / controller / validation      # REST
  templates.service.js                          # CRUD + render()
  engine/
    enqueue.js        # the ONLY entry point for business code
    worker.js         # poller: picks QUEUED rows, renders, sends, retries
    scheduler.js      # daily tick: birthdays, campaign steps
    render.js         # {{var}} substitution, HTML-escape for email
    recipients.js     # consent + contact + opt-out checks, phone → E.164
  providers/
    index.js          # pick provider per channel from env
    email.smtp.js     # nodemailer (Brevo/Gmail/SES all speak SMTP)
    whatsapp.wame.js  # HAND-OFF: builds https://wa.me/<E164>?text=...
    whatsapp.cloud.js # later: Meta Cloud API
    sms.msg91.js      # later
    sms.none.js / whatsapp.none.js  # 'not configured' → SKIPPED with reason
```

Provider contract:
```js
send({ recipient, subject, body, attachments }) →
  { kind: 'sent',    providerMessageId }        // provider delivered it
| { kind: 'handoff', url }                       // a human must tap to finish
| throws ProviderError { retryable: bool }
```
Selection is by env: `COMM_EMAIL_PROVIDER=smtp|none`, `COMM_WHATSAPP_PROVIDER=wame|cloud|none`, `COMM_SMS_PROVIDER=none|msg91`. Swapping WhatsApp from `wame` to `cloud` changes one env var and nothing else — hand-off rows simply stop appearing.

`enqueue({ templateKey, customerId | recipient, channels?, variables, entity, scheduledFor?, dedupeKey, campaign? })`:
1. loads the customer, decides channels = requested ∩ consented ∩ has-contact, minus opt-outs (marketing only) and do-not-contact;
2. writes one `delivery_logs` row per channel (`QUEUED`, or `SKIPPED` with the reason so the history is honest);
3. never sends inline — the worker does that — so checkout is never slowed or failed by a mail server.

Worker: in-process poller started with the server (pm2 keeps it alive), every 20 s: `SELECT … WHERE status='QUEUED' AND scheduled_for <= now() FOR UPDATE SKIP LOCKED LIMIT 20`; render → provider → `SENT`/`HANDOFF`/`FAILED`; retries 3× with backoff 1 min / 10 min / 1 h for retryable errors. A separate queue library (pg-boss) was considered and rejected: the ledger row *is* the job, one table is simpler to reason about and test.

Scheduler: on start and then every hour, run the daily jobs if not yet run today (Asia/Kolkata) — so a laptop switched on at 11:00 still sends the 10:00 birthday batch. Jobs are idempotent through `dedupe_key`.

## 5. Features on top of the engine

### 5.1 Invoice (R-62e)
After a sale or rental **commits**, `enqueue({ templateKey:'invoice', entity:{SALE, uuid}, variables: receipt payload })`. Email gets the branded HTML inline (PDF attachment later). WhatsApp gets the `invoice` text template (number, items summary, total, thank you). POS after *Close transaction* shows chips: *Email: sent* / *WhatsApp: Open WhatsApp* (button) / *Skipped: no consent*. Resend from the sale screen. Dedupe key `invoice:SALE:<uuid>:<CHANNEL>` — a checkout retry never double-sends. Cancel/refund: separate `invoice_cancelled` template, optional.

### 5.2 Birthday programme (R-62f)
Daily job at `comm.send_hour`:
- **Offer**: customers whose birthday is in exactly `days_before` days → `birthday_offer` with `{{offer_text}}`, `{{valid_till}}`. Dedupe per customer per year.
- **Wish**: customers whose birthday is today → `birthday_wish`. No sales pressure; may mention the offer if one was sent.
- Only customers with `dob` and consent. 29 Feb → 28 Feb in non-leap years.
- Admin page *Birthday programme*: on/off, days before, validity, offer text, channels, preview of who is due in the next 14 days, and this year's sent count. Coupons/points/family birthdays: later, they hang off the same job.

### 5.3 Customer enquiries & "it's available" (R-63 built, R-62g later)
- **Built (R-63):** the *Enquiries* tab. Register an enquiry (pick or create the customer, product type / colour / size, free text, notes, promised date). Enquiries are closed **manually only**, with two outcomes: *It's available — tell the customer* (server builds the message, logs a `delivery_logs` row per channel, returns tap-to-send `wa.me` / `mailto:` / `sms:` links) or *Close quietly*. Nothing else is recorded.
- **Decision (user, 2026-09-15): no auto-matching, no auto-notify.** If a customer asked two months ago and we only now got the item, a robot message "it's available" is worse than none. A human decides at close time.
- **R-62g:** swap the hand-off links for `enqueue({ templateKey: 'stock_available' })` once the engine exists; optionally show "N open enquiries asked for this type" on the intake page as a hint only.

### 5.4 Campaigns (R-62h)
Create / edit / clone / pause / resume / cancel. Audience = fixed segments with a live count: all customers, purchased before, high value (≥ ₹X in last 12 months), birthday this month, inactive (> N days), new (< N days). Steps = a list of send dates. At each step's `send_at` the scheduler materialises one `delivery_logs` row per customer per channel (`campaign_id`, `step_id`, `variant_key`). Pause = leave `QUEUED` rows but the worker skips them; Cancel = mark `CANCELLED`. WhatsApp campaign rows land in the hand-off queue (staff taps through them — realistic for tens, not thousands; the Cloud API provider removes the tapping later). A/B: `variants[]` with weights; the materialiser assigns `variant_key` per customer; analytics groups by it.

### 5.5 Messages screen + customer history (R-62d)
- **Messages** page: tabs *To send on WhatsApp* (hand-off queue: customer, preview, **Open WhatsApp** → opens the `wa.me` link in a new tab and marks `SENT`, with *Didn't send* to undo), *Queued*, *Sent*, *Failed* (reason, Retry), *Skipped* (reason).
- Customer profile: *Communication* tab listing every message (channel, template, status, when), filterable by category.

### 5.6 Preferences (R-62i) — preferred channel, marketing opt-out, do-not-contact on the customer form; the engine honours them.

### 5.7 Analytics (R-62j, phase 2) — per campaign / template / channel: queued, sent, handed off, failed, skipped; birthday programme yearly stats; by `variant_key`. Open/click/conversion need links or webhooks → later.

## 6. Phases

| Phase | Tickets | Gate |
|---|---|---|
| **1 — platform + email + wa.me** | R-62a b c d e f g i | SMTP account (Brevo free tier or Gmail app password) |
| **2 — campaigns + analytics** | R-62h j | none |
| **Later (need accounts / public URL)** | R-62k WhatsApp Cloud API + webhooks, R-62l SMS (MSG91 + DLT), R-62m PDF receipt attachment, R-62n public receipt page + Cloudflare tunnel, AI-written copy | Meta WABA; DLT; a public hostname |

## 7. Gotchas to remember
- `customers.phone` is free text. `recipients.js` must normalise: strip spaces/dashes, 10 digits → prefix `comm.whatsapp.default_country_code`; anything else invalid → `SKIPPED: bad phone`.
- Email HTML: escape every variable; template bodies are trusted (admin-edited), variables are not.
- `wa.me` text is URL-encoded and WhatsApp truncates very long text — keep the WhatsApp invoice short.
- The worker must not start in tests (`COMM_WORKER=off` under `NODE_ENV=test`); test the worker by calling `runOnce()`.
- Birthday and campaign jobs run on the shop laptop's clock — force `Asia/Kolkata` in code, do not trust the OS timezone.
