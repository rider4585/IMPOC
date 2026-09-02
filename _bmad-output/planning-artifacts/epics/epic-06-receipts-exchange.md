## Epic 6: Sale Receipts & Retail Exchange

A customer receives a receipt they can view, download, or have sent to them, and can exchange a piece within the shop's return window. Four stories. Story 6.1 is schema-and-plumbing only: it snapshots the exchange window's day count onto every sale at the moment of checkout, settling explicitly — because the alternative, a live `app_settings` read at exchange time, would let an admin's later change retroactively re-decide an already-made sale's eligibility — that a shop owner tightening the window from its default 7 days to 3 can never reach back and refuse an exchange on a sale rung up under the longer window. Story 6.2 builds the one renderer this product will ever have for a receipt: a domain-agnostic assembler over committed rows, and one A5-PDF/on-screen renderer against that shape, with the result never stored (AD-19.2) — and ships three of the four delivery channels (View, Download PDF, Print) against it, so Epic 8's rental hand-over receipt (CAP-18) only has to supply its own assembler later, never a second renderer. Story 6.3 closes the architecture spine's fourth delivery channel per AD-38: a server-side send through the WhatsApp Business Cloud API, entirely outbound from the backend, that reuses Story 6.2's renderer in-process and never touches a client-side share sheet. Story 6.4 is the exchange gesture itself: a reversing line for the returned piece and a new line for the outgoing one, both inside one transaction that never touches the original sale row, the difference collected or refunded, refused outside the window Story 6.1 snapshots, and refused for a cashier specifically when the difference is a refund — reusing the existing `SALES.REFUND` permission the current seeder already withholds from `CASHIER`, rather than inventing a new one. CAP-16, the retail-return capability this exchange flow supersedes, is retired for good: its id is never reused, and no story in this epic resurrects a standalone refund-a-sale path (NFR20).

### Story 6.1: Snapshot the exchange window onto every sale at checkout

As a developer,
I want the exchange window's day count captured onto the sale row itself at the moment of checkout, never re-read from `app_settings` when an exchange is later attempted against that sale,
So that an admin shortening the window from 7 days to 3 can never retroactively refuse an exchange on a sale that was already rung up under the longer window (AD-6, AD-28, FR22/CAP-23).

**Acceptance Criteria:**

**Given** migration `16-create-sale-lines` has already run (Story 5.4)
**When** migration `17-add-exchange-window-snapshot` runs
**Then** it seeds an `app_settings` row `key = 'exchange_window_days'`, `value_type = 'INT'`, `value_int = 7` — the spec's stated default (FR22/CAP-23) — read through Story 1.3's typed accessor exactly like every other runtime-tunable value (AD-28)
**And** the same migration adds `exchange_window_days_snapshot INTEGER NOT NULL DEFAULT 7` to `sales`, with a named `CHECK (exchange_window_days_snapshot > 0)` — the column is `NOT NULL` because Story 6.4's exchange refusal reads it directly and must never fall back to a live `app_settings` lookup, and the `DEFAULT 7` exists only so the `ALTER TABLE` itself succeeds against any row committed before this migration ran (none are expected in this build order, since checkout — Story 5.5 — ships before this story) rather than because a defaulted value is ever meant to be read
**And** this migration takes slot 17, not the slot the Requirements Inventory's migration order implies — every migration Epic 7 was going to number from 17 (`create-rental-bookings`) shifts one slot later than previously implied, the same renumbering pattern Story 4.1 and Story 5.3 already established; **this note must be mirrored into Epic 7's own implementation notes when that epic's stories are written**, not done in this run, since it belongs to an epic this run does not touch

**Given** `sales.service.js`'s checkout function (Story 5.5) already opens one transaction and inserts a `sales` row inside it
**When** this story is implemented
**Then** that same INSERT is extended to also write `exchange_window_days_snapshot`, its value read once via `app-settings.service.js`'s `get('exchange_window_days')` (Story 1.3) inside the same transaction, before the INSERT — so every sale carries forward whatever the window was at the exact moment it was rung up, never a value re-derived later
**And** no write path anywhere else in this epic writes `exchange_window_days_snapshot` — it is set exactly once, at checkout, and is immutable thereafter, matching the append-only tier `sales` already belongs to (AD-5)

**Given** a sale checked out while `app_settings.exchange_window_days` was `7`
**When** an admin later changes that setting's `value_int` to `3`
**Then** the already-committed sale's `exchange_window_days_snapshot` is unchanged at `7` — an automated test checks out a sale, changes the setting, re-reads the sale, and asserts the snapshot value did not move
**And** a second sale checked out **after** the change carries `3` — the same test proves both sales, read side by side, disagree on their window, each correctly reflecting the setting in force at its own checkout moment

**Given** AD-6's exchange-window rule, restated here because this story exists to serve it: an exchange is accepted while `today <= (sold_at AT TIME ZONE 'Asia/Kolkata')::date + :windowDays`
**When** Story 6.4's exchange refusal check runs
**Then** `:windowDays` is always `sales.exchange_window_days_snapshot` on the specific sale being exchanged against — never a fresh `app_settings.exchange_window_days` read — which is this story's whole reason to exist and is verified end-to-end by Story 6.4's own tests, not repeated here

**And** this story ships no route, no controller, and no UI — it is a schema change plus one extension to an existing service function; the exchange gesture itself is Story 6.4's concern

### Story 6.2: Render, view, download, and print the shared A5 receipt

As a cashier,
I want to view, download as a PDF, or print a customer's receipt immediately after a sale commits — generated fresh from the committed rows every time, by the one renderer this product will ever have for a receipt,
So that a customer leaves with an accurate, reproducible record in whichever form they want, and Epic 8's rental hand-over never has to build a second receipt from scratch (FR15/CAP-15, AD-10, AD-19.2, AD-21, AD-24, UX-DR10, UX-DR18).

**Acceptance Criteria:**

**Given** the backend codebase after this story
**When** it is inspected
**Then** a new `modules/sales/receipt.service.js` exports one function, `assembleSaleReceipt(saleUuid)`, that returns a single, domain-agnostic receipt-data shape — `{ reference, date, customer, lines[], totals, payment, rentalTerms }` — and a new `modules/receipts/receipt-renderer.js` (outside `modules/sales/`, so Epic 8 can import it without reaching into the sales module) exports the one function that turns that shape into an A5 PDF via `pdfkit` — the same PDF library Story 1.5 already introduced, so no second PDF-rendering dependency is added
**And** `rentalTerms` is `null` on every shape `assembleSaleReceipt` produces — it is populated only by whatever assembler Epic 8 writes for CAP-18's hand-over receipt, against this same renderer, which is why the shape carries the field now even though nothing in this epic sets it

**Given** a committed sale addressed by its `uuid`
**When** `GET /api/sales/:saleUuid/receipt` is called
**Then** it returns `assembleSaleReceipt`'s shape as JSON: `reference` is the sale's own `uuid`; `date` is `sold_at`; `customer` is `{ name, whatsappNumber }` read from `sales.customer_name_snapshot`/`customer_whatsapp_snapshot` — **never** joined to the live `customers` table (AD-18, AD-24) — so a receipt for a since-erased customer still renders unchanged; each entry in `lines[]` carries the unit's product name, colour, size, and `transacted_price_paise`, plus a `reversed: boolean` flag (`true` only for a line whose `reverses_sale_line_id` is set — no story in this epic produces one, so every line renders `false` until Story 6.4 ships); `totals` is the sum of every **standing** line's `transacted_price_paise` (a reversed line's already-negative price nets out of the sum automatically, needing no special-case subtraction) plus, when the sale carries one, the signed `exchangeDifferencePaise`; `payment` is `sales.payment_method`
**And** the route requires `authenticate` and `authorize(PERMISSIONS.SALES.VIEW)` — the existing permission, already held by `CASHIER`, `MANAGER` and `ACCOUNTANT` — no new permission constant is introduced

**Given** the same sale
**When** `GET /api/sales/:saleUuid/receipt/pdf` is called
**Then** it calls `assembleSaleReceipt` itself (never trusting a client-supplied shape) and streams a generated A5-portrait PDF directly to the HTTP response — no `fs.writeFile` anywhere on this path, and no table anywhere stores a rendered receipt (AD-19.2, NFR16) — so calling this route twice for the same `saleUuid` re-runs the whole assemble-and-render pipeline twice and produces two PDFs with identical content, not one PDF fetched from storage
**And** the PDF renders the seven fixed content blocks in this fixed order, per `EXPERIENCE.md`'s Receipt Contract — **1** Header (shop name, address, phone, no logo), **2** Reference and date, **3** Customer (the snapshotted name/number), **4** Lines (a struck-through style, using `{colors.money-reversed}`, applied to any line where `reversed` is `true`), **5** Totals (including the signed exchange difference when present, in `{colors.money-in}` if positive or `{colors.money-out}` if negative, per `DESIGN.md`'s money-kind colours), **6** Payment, **7** Rental terms footnote — and block 7 renders nothing on a retail receipt, since `rentalTerms` is always `null` here; a retail receipt is visibly six blocks, not seven with an empty one
**And** the page is A5 portrait, margin `{spacing.receipt-margin}`, background `#FFFFFF`, foreground `#1A1A1A` — fixed values, not read from any theme token, matching `{components.receipt-sheet}`'s explicit exemption from the surface/theme system in every channel

**Given** the frontend after this story
**When** a cashier's screen shows a completed sale
**Then** a `{components.receipt-sheet}` component renders `GET /api/sales/:saleUuid/receipt`'s JSON as the **View** channel — on-screen immediately after commit and available again any time later by re-opening the sale — always black-on-white regardless of the active light/dark theme, exactly matching the PDF's seven-block layout and struck-through treatment for a reversed line
**And** a **Download PDF** control fetches `GET /api/sales/:saleUuid/receipt/pdf` and hands the response to the browser's native file-save flow; a **Print** control calls the browser's native print against the same on-screen `{components.receipt-sheet}` markup, governed by one dedicated `@media print` stylesheet that hides every piece of app chrome (navigation, thumb action bar, buttons) and renders only the A5 receipt content (UX-DR18) — neither control writes anything to a server filesystem, and neither introduces a second rendering path: Print reuses the View channel's already-rendered DOM, and Download PDF reuses the same endpoint Story 6.3's WhatsApp channel will also call

**Given** this story's scope
**When** it is reviewed against Story 6.3
**Then** it implements three of the four delivery channels — View, Download PDF, Print — and ships no WhatsApp integration of any kind; the fourth channel, and the parked device-tested decision behind it, is entirely Story 6.3's concern

### Story 6.3: Send the receipt on WhatsApp — a server-side Cloud API send, entirely outbound

As a cashier,
I want to send a customer's receipt straight to the WhatsApp number already on file for them, from the receipt screen, without depending on what my own phone's share sheet happens to support,
So that a customer who doesn't want a print or a manual download still leaves with their receipt on WhatsApp, and the send behaves identically on every device this product will ever run on (FR15/CAP-15, UX-DR10, AD-38).

**Acceptance Criteria:**

**Given** this story's mechanism
**When** it is compared with what this story number originally specified
**Then** the client-side OS-share-sheet path (`navigator.share`/`navigator.canShare` with a `files` payload) and the `wa.me` text deep-link fallback are both removed outright, not patched — no `File` is ever built in the browser for this feature, no `navigator.share`/`navigator.canShare` call exists anywhere in the frontend for it, and no `wa.me` link is generated anywhere; the real-device test the original story required is replaced by Meta's own template-approval process plus one live send against the Cloud API, recorded before this story is considered done

**Given** the backend codebase after this story
**When** it is inspected
**Then** a new route, `POST /api/sales/:saleUuid/receipt/whatsapp`, sits in `modules/sales/` alongside Story 6.2's existing `receipt`/`receipt/pdf` routes, and requires `authenticate` and `authorize(PERMISSIONS.SALES.VIEW)` — the same permission Story 6.2's View/PDF routes already require; no new permission constant is introduced
**And** a new `modules/whatsapp/` module exists, deliberately separate from `modules/sales/`: `whatsapp.service.js` exports `uploadMedia` and `sendTemplateMessage` against the WhatsApp Business Cloud API, and `phone-normalise.js` wraps `libphonenumber-js`; the module carries no routes of its own — it is called from this route today, and is the same client Epic 7's rental hand-over receipt (CAP-18) and Epic 8's rental settlement slip will call later without either epic reaching into `modules/sales/`

**Given** a completed sale addressed by `:saleUuid`
**When** the route is called
**Then** it calls Story 6.2's `assembleSaleReceipt(saleUuid)` and `receipts/receipt-renderer.js`'s PDF function **in-process** — never by issuing its own HTTP fetch back to `GET /api/sales/:saleUuid/receipt/pdf` — to obtain the receipt PDF as an in-memory buffer
**And** that buffer is POSTed to the Cloud API's media endpoint (multipart), returning a `media id`; a pre-approved template message is then sent referencing that `media id` as a `DOCUMENT` header — never a link — which is what keeps the receipt free of any unauthenticated public URL: Meta never fetches a receipt from this system, this system pushes the bytes to Meta
**And** both calls use Node's native `fetch()` — no HTTP client library is added, since this is the first outbound call this backend makes
**And** the buffer is generated, uploaded, and discarded within the one request — never written to disk and never persisted as bytes in any table (AD-19.2) — and no new table, no new migration, and no persisted send log is added anywhere by this story; "sending" is purely the client's own transient in-flight UI state, which the server never tracks

**Given** the sale this receipt belongs to
**When** the send is triggered
**Then** it happens strictly after the client has already received the checkout gesture's own success response — this route is never called from inside, and never chained onto, the checkout transaction, because AD-10 forbids an HTTP call inside a gesture's transaction — and this route itself opens no database transaction of its own, since it writes no row
**And** the sale's own success does not depend on this call in any way: a sale is successful the instant checkout's transaction commits, full stop; a failed, slow, or never-attempted WhatsApp send never rolls back the sale, never invalidates it, never triggers a reversal or a compensating write, and never blocks or delays the checkout response the cashier already saw

**Given** the Cloud API's response to a send
**When** it is interpreted
**Then** a 2xx response carrying a message id means only that Meta **accepted the message for delivery** — never that the customer received it; whether the message actually reached the customer's phone is reported later, asynchronously, by a webhook, and this story deliberately does not build that webhook
**And** the frontend exposes exactly three states for this action — `sending` (the client's own transient in-flight state while the request is outstanding), `accepted` (the synchronous 2xx case), and `failed` (the synchronous rejection case) — and no state anywhere in this story's UI claims or implies the message was delivered
**And** a synchronous 4xx from either Cloud API call — a malformed or unnormalisable number, an authentication failure, a template or parameter mismatch — is the `failed` state

**Given** the route has run to completion
**When** the response is built
**Then** both outcomes above — Meta's acceptance and Meta's synchronous rejection — are a completed, well-formed request, so both return HTTP 200 with `{ success: true, data: { accepted: boolean, reason } }` inside the existing envelope, never a 4xx/5xx the client has to catch specially
**And** only a genuine server fault — an unknown `saleUuid`, an unauthenticated caller, an unhandled exception — goes through the ordinary `error.middleware.js` path; there is no Postgres constraint on this path for AD-11's translation to apply to

**Given** `sales.customer_whatsapp_snapshot`, typed at the counter by staff in whatever form they used
**When** the send is prepared
**Then** it is normalised to E.164 **only at send time**, inside `modules/whatsapp/phone-normalise.js`, immediately before either Cloud API call — never at capture, and never written back onto `customers.whatsapp_number` or `sales.customer_whatsapp_snapshot`; normalisation assumes `+91`/India when no country code is present
**And** a number that fails to parse or validate is never sent — no media upload is attempted for it — and the route returns the same `failed` outcome as a Cloud API rejection, landing on the same fallback below
**And** because this column is never rewritten by normalisation, CAP-13's exact-match lookup-by-number and AD-18's erasure — which both read this same raw column — are unaffected by this story, by construction, not merely left unbroken

**Given** `WHATSAPP_ACCESS_TOKEN` (a System User / long-lived token, never a short-lived user token) and `WHATSAPP_PHONE_NUMBER_ID`
**When** either credential is missing, revoked, or rotated
**Then** both are read as environment variables under the existing never-commit-`.env` policy, and every send attempted after a revocation or rotation fails with an auth error from the Cloud API — this is **not** surfaced to the cashier as a distinct state; it lands on the same generic `failed` outcome and fallback as a bad number, since the cashier at the counter cannot act on a credential problem either way
**And** AD-30's structured logger records the failure's actual category — auth, a bad number, a network error — on every line, so a systemic credential failure is one `grep` away from being told apart from twenty unrelated bad-number failures, even though the counter screen shows the same message for both

**Given** a send that failed, or a customer who does not use WhatsApp at all (indistinguishable from "accepted" under this design, since only a synchronous rejection is ever visible to this system)
**When** the cashier or customer needs the receipt another way
**Then** Story 6.2's View, Download PDF, and Print remain, unconditionally, as the resilient baseline — this send is additive, never the only channel a receipt can reach the customer through, and the counter screen states plainly that every other channel is still available on a `failed` outcome
**And** the send is safely retryable: a retry re-runs the same two Cloud API calls against the same already-committed sale and writes no row anywhere, so tapping *Send* twice risks a duplicate WhatsApp message at worst, never a duplicate sale and never a double charge — no AD-22 idempotency-key treatment is added, and `gesture-type.js`'s enumerated mutating-gesture set gains no new entry for this action, because it is not one

**Given** the template itself
**When** it is composed
**Then** it is always business-initiated — sent immediately after a sale, with no attempt to detect or rely on a customer-opened free-form window — so it always goes through a pre-approved template: a `HEADER` of type `DOCUMENT` carrying the uploaded `media id`, and a `BODY` with a small fixed variable set (customer name, shop name, amount, the sale's own `uuid` as reference); the template name and language live in a small constants file, not `app_settings`, since changing either is a code-and-re-approval event, never something a shop admin does at runtime

### Story 6.4: Retail exchange — reversing line, replacement line, and the signed difference

As a cashier,
I want to exchange a customer's piece for a different one within the shop's return window, in one transaction that never touches the original sale,
So that a customer can swap what they bought without me faking a refund-and-resell, and the piece they bring back goes straight back into stock, sellable again (FR22/CAP-23, AD-6, AD-8, AD-9, AD-10, AD-14, AD-24, AD-29).

**Acceptance Criteria:**

**Given** CAP-16, the old retail-return capability
**When** this story is implemented
**Then** it adds no route, service function, or gesture type resembling a standalone "refund a sale" flow — exchange is the **only** post-sale path this product ever ships (NFR20), CAP-16's id is never reused anywhere in code or documentation, and every acceptance criterion below describes an exchange, never a refund-in-isolation

**Given** an original sale
**When** `POST /api/sales/:saleUuid/exchange` is called with `{ requestUuid, returningUnitUuid, outgoingUnitUuid, outgoingPricePaise, paymentMethod }`
**Then** the service resolves `returningUnitUuid` to a **standing** `sale_lines` row under `:saleUuid` — `unit_id` matching, `reverses_sale_line_id IS NULL` on that line, and no existing row anywhere already carries `reverses_sale_line_id` pointing at it — and rejects with a 404/409 naming the unit if no such standing line exists (covers `domain-model.md`'s blocked case 4, "reversing the same sale line twice", as a named service-level check ahead of AD-9's index catching it only as a last resort)

**Given** AD-6's shop-day-inclusive exchange window and Story 6.1's per-sale snapshot
**When** the exchange request is evaluated
**Then** it is accepted only while `(now() AT TIME ZONE 'Asia/Kolkata')::date <= (sold_at AT TIME ZONE 'Asia/Kolkata')::date + exchange_window_days_snapshot`, evaluated in SQL against **that sale's own** `exchange_window_days_snapshot` — never a fresh `app_settings` read — and refused with a 409 naming the sale's date and the window it was sold under (`EXPERIENCE.md` State Patterns → Outside exchange window), before any write occurs

**Given** the window check has passed
**When** the service processes the returning unit
**Then**, inside one transaction (AD-10), it inserts one new `sales` row with `reverses_sale_id` **and** `exchange_of_sale_id` both set to the original sale's id (`domain-model.md`'s two fields, both pointing at the same original sale on this one new row), `customer_id`/`customer_name_snapshot`/`customer_whatsapp_snapshot` copied from the original sale — the customer does not re-identify themselves for an exchange — `sold_by_user_id` set to the acting cashier or manager, and `payment_method` from the request
**And** it inserts a reversing `sale_lines` row on that new sale — `reverses_sale_line_id` pointing at the original standing line, `unit_id` the returning unit, `transacted_price_paise` and `buying_price_paise` **negated** copies of the original line's values (AD-2's closed exemption for a reversing line)
**And** the header-level `sales_one_reversal` unique index (AD-9, Story 5.4) means an original sale can be the subject of **at most one** exchange event, ever, for its entire lifetime — stated explicitly here because it is easy to assume otherwise: a customer returning a second, different unit bought on the same original multi-line sale cannot be served by a second exchange call against that same `:saleUuid` once the first has committed. This is an accepted limitation of the schema exactly as Story 5.4 built it, not a defect this story introduces or is expected to route around

**Given** the reversing line has been inserted
**When** the service transitions the returning unit
**Then** it calls `transitionUnit({ unitUuid: returningUnitUuid, to: 'IN_STOCK', cause: 'EXCHANGE_RETURN', reason: null, actorUserId, saleLineId: <the just-inserted reversing line's id> }, { transaction })` (AD-8) — a CAS that returns zero rows (the unit was not actually `SOLD`, e.g. already separately marked damaged) rolls back the whole transaction, including the new sale and reversing line just inserted, and returns a 409 naming the unit and its actual current status
**And** the returning unit's `buying_price_paise`, `selling_price_paise` and `floor_price_paise` on `units` are **not** thawed or rewritten by this transition — AD-5's freeze, once tripped by the unit's original sale, stays tripped through an exchange exactly as it stays tripped through AD-35's `LOST`-to-recovery arc; the piece goes back to `in_stock` carrying the same frozen price fields it always had, and an automated test asserts they are unchanged before and after the exchange

**Given** the returning unit is back at `IN_STOCK`
**When** the service prices and processes the outgoing unit
**Then** it re-reads the outgoing unit's own `floor_price_paise` inside the transaction and refuses the **whole exchange** with a 409 naming the outgoing unit and its floor price if `outgoingPricePaise` is below it — mirroring checkout's per-piece floor check (Story 5.5), never a whole-bill spread, since an exchange prices exactly one outgoing piece
**And**, once the floor check passes, it inserts a second `sale_lines` row on the same new sale — `unit_id` the outgoing unit, `transacted_price_paise = outgoingPricePaise`, `buying_price_paise` copied from the outgoing unit's own snapshot, `reverses_sale_line_id NULL` since this is a normal, standing line, not a reversal — and calls `transitionUnit({ unitUuid: outgoingUnitUuid, to: 'SOLD', cause: 'EXCHANGE_SALE', reason: null, actorUserId, saleLineId: <this line's id> }, { transaction })`, whose zero-row CAS failure (another till just sold this same piece) rolls back everything the transaction has done so far, including the return half, and returns a 409 naming the outgoing unit and its real status
**And** `unit-status-cause.js` gains both `EXCHANGE_RETURN` and `EXCHANGE_SALE` as two new, distinct causes, alongside `SALE` from Story 5.5 — kept separate from each other and from `SALE` so `unit_status_events`/Q10's shrinkage read can always tell an exchange-driven restock and an exchange-driven sale apart from an ordinary checkout sale, without inferring it from context

**Given** both lines have committed
**When** the new sale's `exchange_difference_paise` is computed
**Then** it is `outgoingPricePaise − abs(the reversing line's transacted_price_paise)` — positive means the customer owes more and it was collected via `paymentMethod`; negative means cash is owed back to the customer — stored signed, no `CHECK (>= 0)` (AD-2's second closed exemption), and rendered by Story 6.2's receipt renderer in `{colors.money-in}` when positive or `{colors.money-out}` when negative

**Given** `exchange_difference_paise` computes to a negative value (a refunding exchange) and the acting user is a `CASHIER`
**When** the request is evaluated
**Then** it is refused **before any write occurs** — the check runs immediately after the outgoing price and the reversing line's price are both known, but ahead of the transaction's first INSERT — with a response stating the refund amount and that a manager must complete this exchange (`EXPERIENCE.md` State Patterns → Refunding exchange, held by CASHIER), reusing the **existing** `PERMISSIONS.SALES.REFUND` constant (already seeded to `MANAGER` and withheld from `CASHIER` by the current seeder, per AD-29) as the gate — no new permission constant is introduced, and `SALES.CREATE` alone (held by both roles) is sufficient to reach this far into the request, since only the refund direction, not the exchange itself, needs the stronger permission
**And** a `MANAGER` acting on the identical request — same `outgoingPricePaise`, same negative difference — is not blocked by this check, since `MANAGER` holds `SALES.REFUND`

**Given** a September sale exchanged in October
**When** the reversing line's shop day is read from any AD-13 view (`v_net_sale_lines`)
**Then** it is anchored to the **new** sale's own `sold_at` — October — never to the original September sale's date; September's already-closed takings are untouched, and both the negative reversing line and the new positive line land in October's figures (AD-14) — this is automatic, since the reversing line lives on a new `sales` row whose `sold_at` defaults to `now()` at the moment this gesture commits, never a value copied from the original sale

**Given** the `requestUuid` on the request
**When** the service handles this as the `SALE_EXCHANGE` gesture (already enumerated by Story 1.4's `gesture-type.js`)
**Then** it inserts the `request_keys` row last, inside the same transaction, `result_kind: 'SALE'`, `result_uuid` set to the new exchange sale's `uuid` (AD-22's insert-last ordering) — a replay of the same `requestUuid` performs no second CAS, writes no second row, and returns the original committed exchange sale with 200

**Given** the exchange has committed
**When** the response is returned
**Then** it carries the new sale's `uuid` and its two lines; no receipt is rendered inside the transaction (AD-10) — the cashier's next action is opening Story 6.2's receipt for this new sale's `uuid`, which renders the reversed line struck through, the new line, and the signed difference, exactly as `EXPERIENCE.md`'s "Reversals and exchanges print" requires

**And** `POST /api/sales/:saleUuid/exchange` requires `authenticate` and `authorize(PERMISSIONS.SALES.CREATE)` — the existing permission already held by `CASHIER` and `MANAGER` — with the additional `SALES.REFUND` check applied in-service, not at the route layer, precisely because whether it's needed depends on a value (`exchange_difference_paise`) that doesn't exist until the request body has been priced

