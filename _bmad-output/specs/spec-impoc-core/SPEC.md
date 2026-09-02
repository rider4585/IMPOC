---
id: SPEC-impoc-core
companions:
  - glossary.md
  - domain-model.md
  - unit-state-machine.md
  - dashboard-questions.md
  - brownfield.md
  - ../../planning-artifacts/architecture/architecture-IMPOC-2026-08-20/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/ux-designs/ux-IMPOC-2026-08-20/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-IMPOC-2026-08-20/EXPERIENCE.md
  - ../../../AGENTS.md
  - ../../../backend/AGENTS.md
  - ../../../frontend/AGENTS.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

> **Architecture precedence.** `ARCHITECTURE-SPINE.md` is an adopted companion, owned by `bmad-architecture`. It holds the build-level decisions (AD-1 … AD-35) this contract is realised through, and its AD numbering is stable. Where it goes further than this SPEC, it governs; where the two disagree on a domain fact, that is a defect to raise, not to route around.

# IMPOC — Barcode-Driven Inventory, POS, and Rental for SHREE Fashion Store

## Why

SHREE Fashion Store sells and rents women's clothing and imitation jewellery out of one shop floor. Its stock is irreducibly per-piece: a single buying trip yields a dozen kurtis that share a name and a price but differ by colour and size, and a saree that is rented on Friday and returned on Tuesday is a different asset from the identical one sold outright. SKU-level counting cannot answer "where is this exact piece, what did it cost, what is it allowed to sell for, and who has it right now." IMPOC answers that by giving every physical item its own unique Code 128 barcode and making the scan the single operating gesture — at intake, at sale, at rental hand-over, at return. The platform beneath it already exists (auth, RBAC over five roles, a barcode PDF generator, a working camera scanner); nothing the shop actually runs on does. The headline payoff is the dashboard: the owner currently has no way to answer whether the shop made money this month, which vendor's lots move, or how much deposit cash is sitting in the drawer against units still out on rent.

## Capabilities

- **CAP-1** — Barcode sheet printing
  - **intent:** An inventory manager requests a given number of pages and receives a print-ready PDF of blank barcode labels to stick on physical stock.
  - **success:** A request for N pages returns one A4 PDF of N pages; printed at 100% scale each barcode measures 35mm × 8mm (±0.5mm), its human-readable number renders at 5pt directly beneath it, and 15pt of blank space sits below that for handwriting a price. Every page carries the same whole number of labels. Every dimension in that layout — barcode width and height, text size, clear space, margins, and the resulting grid — is a configurable value, so the layout is tuned against a physical print without a code change. A user without the barcode-print permission gets 403; ADMIN and INVENTORY_MANAGER get the PDF.

- **CAP-2** — Barcode uniqueness
  - **intent:** Every barcode value the system prints is unique and is never emitted a second time, so a scan always resolves to at most one physical item — without the system keeping any register of which values it has printed.
  - **success:** Values come from a single persistent counter, strictly increasing, zero-padded to a fixed width, short enough to scan reliably in a 35mm × 8mm Code 128 label. Ten concurrent 100-page requests produce zero duplicates across the whole set and across every sheet printed before them, and the sequence never rewinds after a process restart or a database restore. No table records which values were printed, which sheets they appeared on, or whether they were ever used.

- **CAP-3** — Reference picklists
  - **intent:** An administrator maintains the product-type hierarchy, colour list, size list, and damage-grade list that intake and rental settlement select from, so attributes and charges are chosen and never typed free-hand.
  - **success:** A product type can be created under a parent (Saree → Paithani) and nested lists render as parent/child; intake rejects a colour or size that is not an active picklist entry; each damage grade carries a default charge in paise; deactivating an entry hides it from new use without altering records already made against it.

- **CAP-4** — Vendor registry
  - **intent:** Staff record and reuse the vendors stock is bought from, so every lot traces back to who supplied it.
  - **success:** A buying trip cannot be saved without a vendor; a vendor's page lists every trip, lot, and unit sourced from them.

- **CAP-5** — Record a buying trip
  - **intent:** An inventory manager records one purchase trip — vendor, date, bill reference, total paid — as the header that the trip's lots hang off.
  - **success:** A trip saves with those four fields and reports the difference between its recorded total paid and the sum of (quantity × buying price) across its lots, so a data-entry slip is visible rather than silent.

- **CAP-6** — Define a lot
  - **intent:** An inventory manager enters, once per lot, the attributes every unit in that lot shares — product type, name, quantity, buying price, selling price, floor price, channel, and rental terms when the channel is rental — so those values are never retyped per item.
  - **success:** A lot of 12 round-neck kurtis is entered with one form submission; every unit later scanned into it inherits those values without further typing. A lot whose floor price exceeds its selling price, or whose overdue-per-day is not greater than its rent-per-day, is rejected.

- **CAP-7** — Scan units into a lot
  - **intent:** With a lot open, staff scan a printed barcode and enter only colour and size to create one tracked unit, repeating until the lot is filled.
  - **success:** Scanning any barcode not already bound to a unit creates a unit in the open lot carrying that lot's snapshotted prices, channel, and rental terms, and the screen reads "8 of 12 scanned"; the system does not check that it printed the value itself. Scanning a barcode already bound to any unit is refused with a message naming the existing unit; the lot cannot be closed with a unit count above its declared quantity.

- **CAP-8** — Clone the last lot
  - **intent:** Staff open a new lot pre-filled from the previous one, so a second lot that differs only in a field or two costs one edit rather than a full form.
  - **success:** After closing a lot of 12 round-neck kurtis, "clone last lot" opens a new lot with every field copied and editable; changing the cloned lot never alters the original or its units.

- **CAP-9** — Size-run intake mode
  - **intent:** For a lot that varies only by size, staff turn on size-run mode so the size advances automatically after each scan and only the barcode has to be presented.
  - **success:** With a size run of S/M/L/XL configured on a lot of 12, four scans record S, M, L, XL in order and the fifth wraps to S; the auto-advanced size can be overridden on any individual scan without breaking the sequence for the next.

- **CAP-10** — Unit lifecycle enforcement
  - **intent:** The server permits only the transitions the unit's channel allows, so a unit's status always reflects a real event that happened to the physical item.
  - **success:** Every transition in `unit-state-machine.md` succeeds and every transition absent from it is rejected with the current status named in the error — enforced in the service layer, not the UI. Each accepted transition writes a durable record of what caused it, by whom, and when.

- **CAP-11** — Take a unit out of circulation, and bring a lost one back
  - **intent:** Staff mark a unit damaged, lost, retired, or under maintenance, so stock counts and capital-at-risk figures reflect reality instead of the last happy-path event — and recover a lost piece that turns up again, on either channel.
  - **success:** A unit marked damaged or lost disappears from sellable and rentable stock immediately and appears in the shrinkage figure at its buying price; a rental unit sent to maintenance is unavailable until returned to stock or retired. A lost unit is recovered by one named action, routed to stock, to maintenance, or straight to retirement, keeping its original barcode and its frozen price snapshots — it is never re-intaken as a new unit, and a recovered rental unit returned to stock is bookable again with no residue. A recovery adds that unit's buying price back to stock value and reverses no money: income already recognised stays recognised, and no returned or forfeited deposit becomes a liability again. Every recovery records who did it, when, and a reason that is never defaulted, and is permitted to ADMIN and MANAGER only.

- **CAP-12** — Scan-to-cart
  - **intent:** A cashier builds a sale by scanning items continuously — the camera stays armed and each decoded unit drops straight into the cart with no per-piece confirm tap — seeing each unit's name, size, colour, and selling price and a running total, until one confirm step at the end of the cart hands off to checkout.
  - **success:** Scanning a unit that is not `in_stock` is refused at scan time with its actual status, without breaking the scan loop for the rest of the cart; scanning a unit whose channel is rental is refused from a retail cart; the same barcode scanned twice into one cart adds one line, not two; adding a unit to a cart does not change the unit's status. This scan rhythm is deliberately not the intake rhythm: no price is entered and no floor-price check happens per scan — both happen once, at CAP-14's single confirm step.

- **CAP-13** — Customer capture and lookup
  - **intent:** Before checkout the cashier captures name, WhatsApp number, date of birth, email, and the customer's consent to hold that data — or recognises a returning customer from the WhatsApp number alone.
  - **success:** Entering a WhatsApp number already on file loads that customer's details for confirmation without retyping; a new number creates a customer record carrying a consent flag, the moment it was given, and the purpose it was given for; checkout is blocked until a customer is attached.

- **CAP-14** — Retail checkout
  - **intent:** The cashier completes the sale, recording what was paid, how, and by whom, and moving the scanned units out of stock in one indivisible step.
  - **success:** Checkout succeeds only if every unit in the cart is still `in_stock` at commit time; if two cashiers scanned the same barcode into two carts, exactly one checkout succeeds and the other fails naming the unit. At the single confirm step before payment the cashier prices the bill either of two ways, chosen per bill — a price typed against each line individually, or one negotiated total for the whole cart that the app spreads across lines — and either way every line must still clear its own floor price; a bill that would put any line below its floor is refused, naming that piece, before payment is taken. Having priced the bill, the cashier picks a payment method. On **UPI**, the app draws a QR on the checkout screen and writes nothing to the database while it is displayed — the QR encodes a UPI deep link for this bill's amount and allocates a payment reference (see Constraints), but no sale row and no reference-consuming row exist yet. From there exactly one of three things happens: (1) the customer pays, shows her phone's success screen, the cashier checks it with his own eyes and taps **Mark as received** — the sale commits in one transaction exactly as this capability already specifies (in-stock re-verification, compare-and-swap, snapshots), now also carrying `paymentMethod = UPI` and that payment reference; (2) UPI is unavailable on either side, so the cashier switches the method to cash, the QR is dismissed, and he marks it received — one sale is recorded, as cash, and the reference drawn for the abandoned QR is simply never used; (3) the customer decides not to buy — the cashier cancels the checkout and the cart clears. Because nothing was ever written in any of the three branches until the moment of commit, a cancelled or abandoned checkout leaves no record to delete and no half-finished sale to clean up — that property is the reason for this design. **A human eye, not the app, is the confirmation that payment succeeded:** the system never contacts a payment provider and never itself claims to know whether a UPI payment went through. On success every unit becomes `sold`, each sale line carries the transacted price, and the customer's name and WhatsApp number are copied onto the sale. A unit that was previously sold and later returned to stock through an exchange (CAP-23) checks out exactly like any other `in_stock` unit — an exchange never bars a unit from a future sale, however many times it has already cycled through this.

- **CAP-15** — Sale receipt
  - **intent:** The customer leaves with a receipt listing what they bought, at what price, and how they paid.
  - **success:** A completed sale renders a receipt showing every line with its transacted price, the total, the payment method, the payment reference when the method was UPI, the snapshotted customer name, the date, and a reference that reproduces the same receipt later unchanged.

- **CAP-17** — Book rental units
  - **intent:** A customer books one or more rental pieces for a date range and pays for the whole booking there and then, so the piece is held for their wedding and the shop has its money before anything leaves the floor.
  - **success:** A booking names a start and end date, and rent for the full window plus the deposit are collected at that moment — **both recorded as money held, neither as revenue**, until the booking finishes. The window is counted inclusively: the 15th to the 17th is three days. A unit is bookable for any window that does not overlap one of its existing open bookings, so a saree booked for the 14th–17th can still be booked for the 5th–7th. The booking is refused if its window exceeds `floor(deposit / overduePerDay)` days. A unit whose channel is retail cannot be booked.

- **CAP-18** — Hand over rental units
  - **intent:** Staff release the booked pieces to the customer, printing one receipt for the whole hand-over while each piece settles on its own.
  - **success:** Handing over three sarees creates three agreements sharing one group id and produces one receipt listing all three, each carrying its unit's rent-per-day, deposit, overdue-per-day, start date, and due date snapshotted from the booking. No money changes hands at hand-over — it was collected at booking. Each unit becomes `rented`. Collecting a day later than booked does not extend the window, reduce the rent, or move the due date. A walk-in with no prior booking books and takes hand-over in one transaction, paying rent and deposit at that moment.

- **CAP-19** — Rental return and settlement
  - **intent:** Staff scan a returned piece to close its agreement, assess its condition, settle the deposit, and route the unit back to stock, into maintenance, or straight to retirement.
  - **success:** Scanning a `rented` unit closes only that unit's agreement and leaves the others in its group open. Rent is not recomputed — it was paid in full at booking and is never pro-rated, so an early return refunds nothing. The settlement deducts from the deposit only the overdue charge (computed at settlement, not stored) and a damage or cleaning charge: staff pick a grade from the damage picklist, its default charge pre-fills, and staff may override it for the case in hand. The deposit balance returned to the customer never goes below zero. Staff route the unit to stock, to maintenance, or — on a beyond-repair grade — directly to retired. Returning two of three units on one group leaves the third open and overdue-eligible. Every settlement — whether or not anything was deducted — produces a printed settlement slip showing deposit held, overdue deducted, damage deducted, and cash returned, rendered by the same renderer and A5 layout as the sale receipt. Settlement is the moment the booking's money becomes income, dated to the settlement's own day: the rent, plus any overdue kept, plus any damage kept. A piece that never comes back is instead written off by a staff action — the booking terminates, and the rent and the **whole** deposit become income on the day a person marked it, with nothing returned to the customer and no separate overdue charge on top.

- **CAP-20** — Overdue visibility
  - **intent:** Staff and the owner see, at any moment, which rented units are past their due date and how much has accrued against their deposits — without any scheduled job having run.
  - **success:** A unit `rented` with a due date before today appears as overdue the instant the page is loaded, with accrued charge = overdue days × overdue-per-day, capped at the deposit; no overdue flag, accrued amount, or maximum period is stored in any table; no cron, scheduler, or background worker exists in the codebase. A rented unit whose deposit will be fully eaten by overdue charges appears on a review list from that date onward — `dueDate + floor(deposit / overduePerDay)` days, computed on the same read. That date prompts a person and triggers nothing: no status changes, no money moves, and no row is written when it passes.

- **CAP-21** — Record expenses
  - **intent:** Staff record what the shop spends — rent, maintenance, non-sellable purchases, and upkeep on specific rental units — so the dashboard's profit figures are real.
  - **success:** An expense saves with category, amount, date, and note; an upkeep expense can be attached to a specific unit and then appears against that unit's lifetime earnings; a completed expense is corrected by a reversing row, never an update.

- **CAP-22** — Owner dashboard
  - **intent:** The owner opens one screen and learns how the shop is doing — what came in, what went out, what is sitting on the floor, what is out on rent, and which vendors and lots are worth repeating.
  - **success:** Every question in `dashboard-questions.md` is answered on the dashboard for a user-chosen date range, each figure traceable to the rows behind it, and each derived rather than stored. Numbers reconcile: takings minus reversals equals the sum of the underlying lines. Rental money shows as **three buckets, displayed separately and never added together** — earned income, deposits held, and rent held on bookings that have not finished. Each held bucket is what was collected on every booking still `open` or `handed_over`, with nothing deducted: a booking's finishing event moves it out of those states, so the money leaves the bucket by that state change alone and is never also subtracted, and the same figure appears as income on that event's own day. Because rent and deposit are both collected at booking, neither held figure is ever summed from agreements — a paid booking not yet handed over holds real cash and has no agreement row. The takings figure and the till figure will not match on any given day, and that is correct: cash arrives at booking, income is recognised at the finish. Shrinkage nets recoveries, and a recovery also shows as its own line, valued at the recovered unit's buying price.

- **CAP-23** — Retail exchange
  - **intent:** A customer swaps a bought piece for a different one within the exchange window — the shop's only post-sale path, since it does not do refunds.
  - **success:** Scanning a `sold` unit within the configured exchange window (default 7 days from the sale, admin-changeable) reverses its sale line with a new reversing row — the original sale row is byte-for-byte unchanged — and returns the unit to `in_stock` carrying its original buying, selling, and floor price snapshots. The outgoing piece is sold on a new line in the same transaction. A dearer swap collects the difference as UPI or cash; a cheaper swap refunds the difference in cash. Beyond the window the exchange is refused server-side, naming the sale date. There is no path that refunds a sale outright. Once back `in_stock`, the returned unit is sellable, or exchangeable again, exactly like any other unit — there is no limit on how many times a single piece may pass through this cycle.

- **CAP-24** — Customer data consent and erasure
  - **intent:** The shop can show that a customer agreed to their details being held, and can erase those details on request without destroying the shop's transaction history.
  - **success:** Every customer record carries the consent flag, timestamp, and purpose captured at CAP-13. An administrator can erase a customer: name, WhatsApp number, date of birth, and email are anonymised on the Customer row and the WhatsApp number is released for reuse by a different person. The name and number snapshotted onto past sales and rental agreements are left untouched, so every receipt still reproduces and every takings figure still reconciles. An erased customer cannot be found by their old WhatsApp number.

- **CAP-25** — Extend a booking
  - **intent:** Staff extend a booking that has not yet been handed over — the customer wants the pieces for longer, the dates move out — collecting the extra rent at the counter.
  - **success:** A booking's window may be widened at either end while it is still `open`; the extended window must **contain** the original window — narrowing at either end is refused, and no rent is ever refunded on an amendment. Rent is recomputed over the new window by the same day-count formula used at booking (CAP-17), and the difference is collected at the counter in the same gesture. The extension is re-checked against `floor(deposit / overduePerDay)` exactly as the original booking was, so a longer window against an unchanged deposit is refused. A booking that is `handed_over`, `settled`, `cancelled`, or `written_off` cannot be extended.

## Constraints

- All money is stored and computed as integer paise. No float, no decimal type, no rupee-denominated column.
- Prices are snapshotted at two levels: a unit copies its lot's buying, selling, and floor prices (and rental terms) at intake; a sale line or rental agreement copies the transacted price at checkout. Editing a lot or a unit never alters a recorded transaction.
- A completed sale, rental agreement, or expense is never UPDATEd. Corrections are new reversing rows referencing the original. Customer erasure (CAP-24) does not breach this: it touches the Customer row only, never a transaction.
- The transacted customer name and WhatsApp number are copied onto the sale or rental agreement. Editing or erasing the customer record never rewrites history.
- Overdue status, maximum rental period, and the date a late hire's deposit runs out are all derived on read — `rented AND today > dueDate`, `floor(deposit / overduePerDay)`, and `dueDate + floor(deposit / overduePerDay)` days. None is stored, and no cron job, scheduler, or background worker may be introduced to maintain them. The exhaustion date prompts a person to act and triggers nothing itself.
- Every table carries created/updated timestamps and a soft-delete column. No domain row is ever hard-deleted.
- `in_cart` is not a unit status. Carts hold references to units; checkout re-verifies `status == in_stock` inside the same database transaction that writes the sale. **The status change itself is the race guard** — a conditional update that succeeds only while the unit is still `in_stock`, so exactly one of two competing checkouts wins and the other is told which unit it lost. There is deliberately **no** unique constraint on `unit_id` in sale lines: an exchange sells the same unit again on a new line, and that index would refuse it. On the rental side the guard is a database fact — at most one open, not-written-off agreement per unit.
- `reserved` is not a unit status. Rental availability is a query for overlapping open bookings on the requested date range; a unit with a future booking stays `in_stock` and remains bookable for any non-overlapping window.
- Rent and deposit are collected in full at booking, never at hand-over. Rent is never pro-rated: an early return, a late collection, a cancellation, or a no-show all leave the rent as charged. Settlement deducts only overdue and damage/cleaning from the deposit.
- Rent and deposit are **money held, not income**, from the moment they are collected until the booking finishes. Income is recognised at that finishing event and dated to the day it happened, never to the day the booking was made. A booking finishes in exactly four ways and no others: returned clean (the rent, plus any overdue kept), returned damaged and settled (the rent, plus any overdue, plus the damage kept from the deposit), cancelled before hand-over (the rent, forfeited — the deposit goes back in full and is not income), and written off because the piece never came back (the rent and the whole deposit, with nothing going back). A booking that has not finished contributes nothing to any income figure.
- A damage or cleaning charge kept from the deposit at settlement is income against that unit; the repair or replacement it funds is booked separately as a `RENTAL_UPKEEP` expense against the same unit. Two rows, never one netted figure, so both sides show on the unit and the effect on profit is honest.
- A unit reaching `lost` is an audit fact and never an income anchor, with a live agreement or without one. The forfeited rent and deposit are dated to the write-off and to nothing else — one anchor, so the same money cannot be counted twice.
- Rental days are counted inclusively as `(endDate − startDate) + 1`, everywhere: the rent charged at booking, the maximum-period check, and utilisation. The 15th to the 17th is three days.
- `lost` is not terminal. Exactly one action leaves it — a recovery — on either channel, routing the unit to stock, to maintenance, or to retirement. A recovery moves stock value only: no recognised income is un-recognised, no deposit becomes a liability again, and no reversing row is written against any money table.
- The shop does not refund sales. The only post-sale path is exchange (CAP-23), inside an admin-configurable window defaulting to 7 days.
- `channel` (retail | rental) lives on the Unit and defaults from the lot, so a unit can be converted between channels later without a migration.
- Colour, size, and damage grade are picklist references, never free-text columns.
- A sale line priced below that unit's snapshotted floor price is refused server-side. The UI may warn earlier but is not the enforcement point.
- A lot's overdue-per-day must exceed its rent-per-day.
- Payment method is recorded as UPI or cash. No payment gateway, no card processing, no payment provider SDK. UPI payment is confirmed by a human eye, not by the system: the cashier generates the QR himself, the customer pays with her own UPI app, shows the success screen on her phone, and the cashier's visual check of that screen — followed by his own "Mark as received" tap — is the entire confirmation. The app never talks to a payment provider and never itself asserts that a payment succeeded.
- A UPI QR's amount is a request, not a lock — some UPI apps let the payer edit it before paying. The QR is therefore never treated as proof of payment; the cashier's visual check of the payer's success screen (above) is the actual control.
- The UPI deep link is assembled from rupees with two decimals while every stored amount is integer paise. The system names exactly one conversion point between the two, and that conversion must be exact — a mismatch between the amount shown on the QR and the amount recorded on the sale is the worst bug available in this feature. (Where that conversion point lives is an architecture decision, not modelled here.)
- **Payment reference** — short, human-readable, sequential, allocated from a Postgres sequence at the instant a UPI QR is drawn, and stored on the sale (or rental booking) only if it commits. Because nothing is written before the payment is marked received, a checkout that is cancelled or switched to cash after the QR was drawn burns its reference and leaves a gap; gaps are expected and harmless, and reconciliation against the bank statement matches on references that appear, never on a complete run. **This is deliberately not an invoice number.** GST is a current non-goal, but Indian GST requires consecutively numbered invoices with no gaps, so a gapped series can never become the invoice series — if an invoice number is ever introduced it is a separate identifier, from its own sequence, allocated only at commit for sales that actually complete. The sequence's exact naming and format are an architecture decision, not modelled here.
- The UPI QR mechanism is a **general payment surface**, not retail-only: the same draw-QR / write-nothing-until-confirmed / Mark-as-received flow and the same payment-reference allocation apply wherever UPI is chosen as the payment method — retail checkout (CAP-14), rental booking and walk-in hand-over (CAP-17, CAP-18), and booking extension (CAP-25) alike, since all four collect money at the counter the same way and already share the `UPI | CASH` payment-method field.
- Every barcode is Code 128 and belongs to exactly one physical unit for that unit's whole life. Values come from a single persistent counter that survives restart and restore; uniqueness may not rest on a timestamp, an in-memory counter, or a register of issued values. The system keeps no record of which values it has printed — `unit.barcode`'s unique constraint is the only binding guard.
- Barcode PDFs use `bwip-js` and `pdfkit` only. No second barcode or PDF library. All label dimensions are configuration, not literals.
- No reusable product-template or master-catalogue table. Prices change every trip, so lot-level entry is the template.
- The system is online-only. No service worker, offline queue, local-first store, or sync layer.
- Backend structure, validation, error shaping, response envelope, permission constants, and Sequelize layout follow `../../../backend/AGENTS.md`; frontend camera and HTTPS constraints follow `../../../frontend/AGENTS.md`. Where this spec and those files appear to disagree, those files win and the disagreement is a defect to raise, not to route around.
- Access control reuses the five existing roles and adds new permissions as constants in `backend/src/constants/permissions.js`, seeded to roles. Rental operations get their own `RENTALS.*` group rather than riding on `SALES.*`, so selling rights and rental hand-over rights are granted separately. No route may test a role name or a string-literal permission.

## Non-goals

- Refunding a sale outright, store credit, or a customer balance ledger. Exchange is the only post-sale path.
- Pro-rating rent on early return, refunding rent on cancellation, or refunding rent on a narrowed booking amendment — rent, once collected, is never returned by any route (CAP-25).
- GST registration, tax invoicing, HSN codes, or a CGST/SGST split. The shop is not registered. (Registration is expected later; do not design the Sale, SaleLine, or receipt in a way that blocks adding tax lines.)
- Loyalty schemes, points, or tiers for returning customers. (Customer identity is captured now; do not design in a way that blocks this later.)
- Occasion-based offers or campaigns, including anything driven by the captured date of birth. (DOB is collected now, under recorded consent, and has no consumer in this scope.)
- Vendor returns, and defect-rate-by-vendor tracking. (Vendor and lot lineage is recorded now; do not design in a way that blocks this later.)
- Any payment gateway, online payment, or card-present integration. Payment method is a recorded fact.
- Offline operation, background sync, or a service worker.
- A reusable product-template / master-catalogue table.
- Any cron, scheduler, or background worker.
- Multi-store or multi-location inventory, and any currency other than INR.
- A customer-facing storefront, online catalogue, or self-service booking.
- Channel conversion (retail ↔ rental) on an existing unit. The field lives on the unit so it stays possible; the flow is not built.
- Recording any identity document at rental hand-over. Rent plus deposit, both collected up front, already exceed the piece's buying price, so a piece that never comes back has been paid for and there is nothing for an ID to secure. No identity-type, identity-reference, or document-image column exists on a rental agreement. *(Closed 2026-08-20; recorded so it is not reopened.)*
- A wireless payment-status display — Raviraj intends an ESP32 device with its own screen that shows the current QR and a payment-received animation, driven from the POS. Out of scope now; the QR renders on the checkout screen itself, and nothing is built for the device yet. (Do not design against this later: keep the UPI link's content reproducible server-side from the payment reference alone, so such a device could fetch and redisplay it — but the device itself is not this scope's problem.)

## Success signal

On a real buying day the owner intakes a whole day's buying — two vendor trips, five lots, 48 pieces — by scanning printed labels and typing nothing but colour and size, and each trip's recorded total paid reconciles against its lot costs on screen. That same week a cashier rings up a bill by scanning items straight into the cart with the camera never pausing, enters one bargained total at the single confirm screen, is refused when the spread would push a piece below its floor price, has her pay by scanning the UPI QR the till draws on the spot — nothing is recorded until the cashier sees her phone's success screen and taps Mark as received — and takes a piece back three days later as an exchange for a dearer one, collecting the difference. A customer books three sarees for the 14th–17th and pays rent and deposit on the spot; the same sarees are still bookable for the 5th–7th. The customer later moves the booking out to the 20th, paying the extra rent for the widened window on the spot. Two come back on the 17th — one clean, one needing cleaning, its grade picked from the list and the charge taken off the deposit — and the third shows as overdue with its accrued charge the moment the page loads. Each return prints a settlement slip, deposit and deductions itemised, whether or not anything was kept. At close of month the owner opens the dashboard and answers, without opening a database client or a notebook, whether the shop made money, which vendor's lots sold through, how much deposit cash and how much unfinished-hire rent is being held against pieces still out — both shown apart from what the shop has actually earned — and which rental units have paid for themselves.

## Retired capability IDs

- **CAP-16** — Retail return. Retired 2026-08-20: the shop has no return policy. Superseded by CAP-23 (Retail exchange). The ID is never reused.
