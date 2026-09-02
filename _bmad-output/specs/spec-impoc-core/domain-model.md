# Domain model

Entities, the fields that are load-bearing, and the constraints that must exist in the schema rather than in application code. Field names are indicative; storage conventions (snake_case columns, timestamps, soft delete, integer paise) come from `../../../backend/AGENTS.md` and apply to every table below without restatement.

Six entities were decided in the source input and are not open to redesign: `ProductType`, `Vendor`, `StockIntake`, `StockIntakeLine`, `Unit`, and the rule that colour and size are picklists. Everything else here follows from the capabilities.

---

## Reference data

### ProductType
Self-referencing picklist. `parentId` nullable — null means a top-level type, set means a subtype.

| Field | Notes |
|---|---|
| `name` | Top level: Kurti, Saree, Jeans. Subtypes: Kurti → V-neck, U-neck; Saree → Paithani, Tissue Silk; Jeans → Baggy. |
| `parentId` | FK to `ProductType`. Null for top level. |
| `isActive` | Deactivating hides it from new intake; existing units keep their reference. |

Unique on `(parentId, name)`. A type may not be its own ancestor.

### Colour, Size
Flat picklists, same shape: `name`, `isActive`, plus a `sortOrder` on Size so S/M/L/XL orders correctly for the size-run mode (CAP-9). Units reference them by id. No free-text colour or size column exists anywhere.

### DamageGrade
The graded condition list staff pick from at rental settlement (CAP-19), running from clean through cleaning and repairable damage to beyond-repair.

| Field | Notes |
|---|---|
| `name` | "Clean", "Light cleaning", "Heavy cleaning", "Repairable damage", "Beyond repair". |
| `defaultChargePaise` | Pre-fills the deduction. Staff may override per settlement. |
| `outcome` | `RETURN_TO_STOCK`, `SEND_TO_MAINTENANCE`, or `RETIRE` — drives which transition the return offers. |
| `sortOrder`, `isActive` | |

### Vendor
`name`, `phone`, `address`, `notes`, `isActive`.

---

## Barcode generation

CAP-2 requires unique, never-repeating values **without** a register of what was printed. The system stores a high-water mark and nothing else — no batch rows, no issued-value rows, no record of which sheets exist on paper.

### BarcodeCounter
A single row (or an equivalent database sequence): `lastIssuedNumber`, incremented atomically inside the request that generates a sheet run. A value is the configured prefix plus that number zero-padded to a fixed width, short enough to encode legibly in a 35mm × 8mm Code 128 label.

The counter never rewinds — not on restart, not on restore. Uniqueness may not rest on a timestamp or an in-memory counter (see `brownfield.md`, D2).

There is deliberately **no** `BarcodeBatch` or `BarcodeIssue` table. `Unit.barcode`'s unique constraint is the only binding guard, and intake accepts any value not already bound.

---

## Intake

### StockIntake — the trip

| Field | Notes |
|---|---|
| `vendorId` | Required. |
| `purchasedOn` | Date of the trip. |
| `billReference` | Vendor's bill/invoice number, free text. |
| `totalPaidPaise` | What was actually handed over. |

The variance between `totalPaidPaise` and `Σ(line.quantity × line.buyingPricePaise)` is derived and displayed (CAP-5), never stored.

### StockIntakeLine — the lot

| Field | Notes |
|---|---|
| `stockIntakeId` | FK. |
| `productTypeId` | FK. May be a subtype. |
| `name` | "Round-neck kurti". Free text — this is the shop's own naming, not a picklist. |
| `quantity` | Units expected in this lot. Intake progress counts against it. |
| `buyingPricePaise` | Per unit. |
| `sellingPricePaise` | Per unit. |
| `floorPricePaise` | Per unit. Must be ≤ selling price. |
| `channel` | `retail` or `rental`. Default for every unit scanned into this lot. |
| `rentPerDayPaise` | Required when channel is rental, else null. |
| `depositPaise` | Required when channel is rental, else null. |
| `overduePerDayPaise` | Required when channel is rental. **Must be > `rentPerDayPaise`.** |

Editing a lot after units exist changes the lot only. Units already created keep their snapshots.

### Unit

| Field | Notes |
|---|---|
| `barcode` | The bound Code 128 value. **Unique — the only guard against a value being used twice.** |
| `stockIntakeLineId` | FK to its lot — the lineage to vendor, trip, and buying price. |
| `colourId`, `sizeId` | FK to picklists. The only two things typed per item at intake. |
| `status` | See `unit-state-machine.md`. Never `in_cart`, never `reserved`. |
| `channel` | Copied from the lot at intake, but stored on the unit so a later retail↔rental conversion needs no migration. |
| `buyingPricePaise`, `sellingPricePaise`, `floorPricePaise` | **Snapshots** taken from the lot at intake. Survive an exchange unchanged. |
| `rentPerDayPaise`, `depositPaise`, `overduePerDayPaise` | Snapshots, null for retail units. |

---

## Unit history

### UnitStatusEvent
One row per accepted transition (CAP-10): `unitId`, `fromStatus`, `toStatus`, `reason`, `actorUserId`, `occurredAt`, and a nullable reference to the sale line or rental agreement that caused it. This is the audit trail; the unit's `status` column is a cached projection of the latest event.

A recovery out of `lost` (CAP-11) is one such row, and `reason` is **mandatory** on it — never defaulted. One row carries both halves of a `lost → retired` recovery: it is an exit from `lost` and an entry into `retired` at once, so the stock value it adds back and the stock value it writes off cancel to zero while the recovery itself stays visible.

---

## Retail

### Customer

| Field | Notes |
|---|---|
| `whatsappNumber` | **Unique. The lookup key at capture time** — a returning customer is found by this alone (CAP-13). Released on erasure so a different person may later use the same number, which is exactly why **no historical or dashboard read may match a customer on this column**: matching on it detaches an erased customer's history and merges the next person to reuse the number into it. History matches on `customerId`, which survives erasure. |
| `name`, `email`, `dateOfBirth` | Captured at first sale. DOB has no consumer in this scope; it exists so occasion-based offers stay possible later. |
| `consentGivenAt`, `consentPurpose` | Recorded at capture (CAP-13). Null is not a valid state for a customer attached to a transaction. |
| `erasedAt` | Set when an administrator erases the customer (CAP-24). Name, WhatsApp, DOB and email are anonymised on this row; snapshots on past transactions are untouched. |

### Sale

| Field | Notes |
|---|---|
| `customerId` | FK. |
| `customerNameSnapshot`, `customerWhatsappSnapshot` | Copied at checkout. Editing **or erasing** the customer never rewrites a completed sale. |
| `paymentMethod` | `UPI` or `CASH`. Recorded only. |
| `paymentReferenceCode` | Set only when `paymentMethod` is `UPI`. Allocated from a Postgres sequence the instant the checkout QR is drawn — before the sale exists — and written onto this row only if checkout commits. Short, human-readable, sequential. **Not an invoice number** — see the callout below. |
| `soldByUserId`, `soldAt` | For per-cashier reporting. |
| `reversesSaleId` | Null on a normal sale; set on a reversing row (CAP-23). |
| `exchangeOfSaleId` | Set on the new sale written by an exchange, pointing at the sale being exchanged against. |
| `exchangeDifferencePaise` | Signed. Positive = collected from the customer; negative = refunded in cash. |

**Payment reference vs. invoice number — deliberately two different things.** The payment reference is drawn from its sequence the moment the UPI QR renders, before anything about the sale is written. A checkout that is then cancelled, or switched to cash, never consumes that reference — the sequence simply gaps. A gap is expected and harmless: reconciliation against the bank statement matches on references that appear, never on a complete run. Indian GST, by contrast, requires invoices to be numbered **consecutively with no gaps**; GST is a current non-goal, but the spec already carries a note not to design against adding it later. A gapped series can therefore never double as the invoice series. If an invoice number is ever introduced, it is a separate identifier, from its own sequence, allocated only at commit and only for sales that actually complete — never the payment reference renamed.

### SaleLine

| Field | Notes |
|---|---|
| `saleId`, `unitId` | FKs. **No unique constraint on `unitId`** — the two-carts race guard is the conditional status change on the unit inside the checkout transaction, not an index here. An exchange sells the same unit again on a new line, so a unique index would refuse the one flow CAP-23 exists for. |
| `transactedPricePaise` | Snapshot of what was actually charged. Refused if below the unit's `floorPricePaise`. |
| `buyingPricePaise` | Snapshot, so realised margin is computable without joining back through the lot. |

An exchange (CAP-23) writes a reversing `Sale` with negated lines for the returned unit and a normal line for the outgoing unit. The original sale row is never touched. Exchanges are refused past the configured window.

At the CAP-14 confirm step, `transactedPricePaise` is the per-line result whether it was entered directly against that line or derived from spreading one whole-bill negotiated total across the cart's lines — no separate whole-bill-total column is stored anywhere. The spreading rule itself is an architecture decision, not modelled here.

**The checkout race guard, precisely stated:** at most one STANDING sale line exists per unit at any time — a sale line that has not itself been reversed by a later reversing line. A reversed line no longer counts. This is one word different from an earlier, wrong version of this rule ("non-reversing" instead of "standing") that counted the original line of an exchanged unit forever and so made that unit unsellable for the rest of its life. The corrected rule needs no index of its own: a unit carrying a standing sale line is `sold`, and a unit with no standing sale line is `in_stock` (`unit-state-machine.md`), so AD-8's compare-and-swap on `units.status` **is** the enforcement of this rule, not a replacement for it.

Allowed, explicitly, so no builder has to guess:

1. First sale of a unit never sold before.
2. Sale of a unit that was sold, then exchanged out — its line reversed — and returned to stock.
3. Any number of repetitions of case 2. There is **no cap** on how many times one unit may be exchanged and resold, though it is not expected to happen often.
4. A unit acting as the replacement piece in someone else's exchange — case 1 or case 2 for that unit, exactly as above.

Blocked:

1. Selling a unit that is currently `sold`.
2. Selling a unit that is `damaged`, `lost`, `retired`, or `in_maintenance`.
3. Selling a rental-channel unit at the retail till.
4. Reversing the same sale line twice.
5. Two checkouts completing on the same unit at the same moment.

---

## Rental

### RentalBooking
The paid date-range hold (CAP-17). Created at booking, or in the same transaction as hand-over for a walk-in.

| Field | Notes |
|---|---|
| `groupId` | Shared by every booking made in one counter interaction. Drives the single receipt. |
| `unitId` | One row per unit. |
| `customerId` + name/WhatsApp snapshots | Same rule as Sale. |
| `startDate`, `endDate` | Inclusive bounds. **Rental days are `(endDate - startDate) + 1`** — the 15th to the 17th is three days — and that count may not exceed `floor(deposit / overduePerDay)`. The same formula charges the rent and drives utilisation; there is no second day-count anywhere. |
| `rentChargedPaise`, `depositPaise` | **Both collected at booking, and both are money held until the booking finishes.** Neither is revenue while the booking is `open` or `handed_over`. |
| `paymentMethod` | `UPI` or `CASH`, recorded at booking. |
| `paymentReferenceCode` | Set only when `paymentMethod` is `UPI`. Same allocation discipline as `Sale.paymentReferenceCode` above — the QR mechanism is a general payment surface, not retail-only. |
| `state` | `open`, `handed_over`, `settled`, `cancelled`, `written_off`. The last three are terminal and each is a finishing event that recognises income (see money rule 3). |
| `cancelledAt`, `cancelledByUserId`, `depositReturnedPaise` | Written once when the booking is cancelled. A cancelled booking never produced an agreement, so the deposit refund is recorded here — otherwise the till reconciliation loses it. `cancelledAt` is the day the forfeited rent becomes income. |

**Extension rule (CAP-25):** `startDate` and `endDate` may be widened — never narrowed — while `state` is `open`. `rentChargedPaise` recomputes with them by the same rental-days formula, and the difference is collected at the counter in the same gesture. No other field on an `open` booking is ever amended this way, and the row stays otherwise governed by the tier-two freeze once it leaves `open`.

**Availability rule, enforced server-side:** a unit is unavailable for a requested window if it has an `open` or `handed_over` booking whose `[startDate, endDate]` overlaps it. Non-overlapping windows on the same unit are legal and expected. A `settled`, `cancelled` or `written_off` booking blocks nothing, so a recovered unit is bookable again with no residue.

### RentalAgreement
Created at hand-over (CAP-18), one row per unit, carrying the terms snapshotted from the booking.

| Field | Notes |
|---|---|
| `bookingId`, `groupId`, `unitId` | **`unitId` unique among agreements that are neither returned nor written off** — a database fact, so a unit cannot be out on two hires at once, and a written-off piece releases its slot for a later recovery. |
| `rentPerDayPaise`, `depositPaise`, `overduePerDayPaise` | Snapshots taken from the unit at booking. `depositPaise` here is settlement arithmetic only — the deposit liability is summed from `RentalBooking`, never from agreements. |
| `startDate`, `dueDate` | Carried from the booking unchanged. A late collection does not move them. |
| `handedOverAt`, `returnedAt` | `returnedAt` null while open, and **never written for a piece that did not physically come back**. |
| `writtenOffAt` | Stamped when staff mark a piece as never returned. **The single anchor** for the forfeited rent *and* the forfeited deposit. A unit reaching `lost` is never a second anchor. Set in the same transaction that moves the booking to `written_off` and the unit to `lost` — all three writes, or none. |
| `damageGradeId`, `damageChargedPaise` | Written at settlement. The grade's default charge, or the staff override. |
| `overdueChargedPaise`, `depositReturnedPaise` | Written once at settlement. `depositReturnedPaise` never below zero. |
| `reversesAgreementId` | For corrections. |

**Never stored:** overdue flag, accrued overdue amount, days overdue, maximum period. All four are computed on read (CAP-20).

**Never recomputed:** rent. It was charged in full at booking and is not pro-rated for an early return, a late collection, a cancellation, or a no-show.

---

## Expenses

### Expense

| Field | Notes |
|---|---|
| `category` | `SHOP_RENT`, `MAINTENANCE`, `NON_SELLABLE_PURCHASE`, `RENTAL_UPKEEP`. |
| `amountPaise`, `incurredOn`, `note` | |
| `unitId` | Nullable. Set for `RENTAL_UPKEEP` so upkeep lands against a specific unit's lifetime earnings. |
| `reversesExpenseId` | Corrections are reversing rows, never updates. |

A damage or cleaning charge kept from the deposit at settlement is **income against the unit**; the repair or replacement it funds is a `RENTAL_UPKEEP` expense against the same unit. Two rows, never one netted figure — both sides show against the unit and the effect on profit is honest. Confirmed by Raviraj, not assumed.

---

## Money and derivation rules

1. Every amount column is an integer count of paise, named with a `Paise` suffix.
2. Rounding happens once, at the point of display. No intermediate rounding.
3. **Rental money sits in three buckets, and every paise is in exactly one of them at any instant.** *Earned* is the only income. *Deposits held* and *rent held* are both liabilities: the deposit and the rent collected on every `RentalBooking` still `open` or `handed_over`, with nothing deducted from either. Money leaves a held bucket in exactly one way — the booking's state leaves those two — and lands in earned at that same instant, dated to the finishing event's own day. Nothing is ever subtracted from a held figure; `depositReturnedPaise` is a cash-movement figure whose only reader is the till reconciliation. Because both are collected at booking, neither held figure is ever summed from `RentalAgreement` — a paid booking awaiting hand-over holds real cash before any agreement row exists, and a `handed_over` booking would otherwise be counted twice.
4. **Income is recognised at the finishing event, never at booking.** The four finishing events are exhaustive: returned clean (rent + any overdue, dated to `returnedAt`), returned damaged and settled (rent + any overdue + the damage kept, dated to `returnedAt`), cancelled before hand-over (the rent, forfeited, dated to `cancelledAt`; the deposit returned in full and never income), and written off (rent + the **whole** deposit, dated to `writtenOffAt`, nothing returned and **no separate overdue row** — the overdue is what ate the deposit). A booking still `open` or `handed_over` contributes to no income figure at all, which is why amending an open booking's window can never rewrite a month the owner has already read.
5. Nothing derivable is stored: overdue state, maximum rental period, trip variance, sell-through, utilisation, payback, ROI, aging, and every dashboard figure are computed at read time.
6. Single shop, single location, single currency. No store/location dimension and no currency column on any table.
7. The UPI QR is the one place a rupee-with-decimals amount is ever produced. It is derived from the relevant integer-paise amount (a sale's total, a booking's rent plus deposit, an extension's rent difference) at exactly one conversion point, exactly, at the moment the QR is drawn. No other rupee-denominated representation of that amount exists anywhere in the system.
