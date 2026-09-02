# Glossary

Terms below are used precisely throughout `SPEC.md` and its companions. Where shop vocabulary and code vocabulary differ, both are given.

| Term | Meaning |
|---|---|
| **Unit** | One physical item — this kurti, this pair of earrings. The atom of the whole system. Carries its own Code 128 barcode for life. |
| **Barcode** | A Code 128 value from the shop's counter, printed on a sheet and later bound to exactly one unit. Never repeated. The system does not track which values it has printed — only the counter's high-water mark. |
| **Trip** (`StockIntake`) | One buying visit to one vendor on one date. Header for that visit's lots: vendor, date, bill reference, total paid. |
| **Lot** (`StockIntakeLine`) | A group of identical items bought on one trip — same product type, name, quantity, buying price, selling price, floor price, channel, and rental terms. The lot *is* the data-entry template; there is no separate template table. |
| **Product type** | A picklist entry that may nest one level or more under a parent via `parentId` — Kurti → V-neck, Saree → Paithani, Jeans → Baggy. |
| **Channel** | `retail` or `rental`. Lives on the unit, defaulted from its lot. Determines which state machine and which transactions apply. |
| **Buying price** | What the shop paid per unit. The basis for margin and for capital-at-risk figures. |
| **Selling price** | The intended retail price, printed by hand on the label at intake. |
| **Floor price** | The lowest price a unit may be sold at. A sale line below it is refused server-side. |
| **Snapshot** | A copy of a value taken at the moment of an event, stored on the row recording that event. Units snapshot lot prices at intake; sale lines and rental agreements snapshot the transacted price, and the customer's name and WhatsApp number, at the transaction. |
| **Reversing row** | A new row that negates an earlier completed transaction. Completed sales, rentals, and expenses are never UPDATEd; corrections are always additive. |
| **Exchange** | The shop's only post-sale path. A sold piece is swapped for another within the exchange window; the difference is collected or refunded in cash. There is no refund of a sale. |
| **Exchange window** | The number of days after a sale during which an exchange is accepted. Default 7, admin-configurable, enforced server-side. |
| **Booking** (`RentalBooking`) | A paid date-range hold on a rental unit. Rent for the whole window and the deposit are collected when the booking is made, not at hand-over — and both are money held, not income, until the booking finishes. |
| **Rental days** | `(endDate − startDate) + 1`. The 15th to the 17th is three days. One formula, used by the rent charged at booking, the maximum-period check, and utilisation alike. |
| **Extension** | Widening an `open` booking's window at either end, never narrowing — the extended window must contain the original (CAP-25). Recomputes rent over the new window by the rental-days formula; the difference is collected at the counter and no rent is ever refunded on an extension. Re-checked against the maximum rental period exactly as the original booking was. |
| **Finishing event** | The moment a booking ends and its money becomes income, dated to that day. Exactly four exist: returned clean, returned damaged and settled, cancelled before hand-over, and written off. |
| **Rent held** | Rent collected on bookings that have not finished. A liability, not income — the third money bucket alongside deposits held and earned income, and never added to either. |
| **Write-off** | The staff action that closes a booking whose piece never came back. The booking terminates, the rent **and the whole deposit** become income on that day, and nothing goes back to the customer. The unit moves to `lost` in the same transaction, as an audit fact — that transition is never itself an income anchor. |
| **Deposit-exhaustion date** | `dueDate + floor(deposit / overduePerDay)` days: the day a late hire's deposit is fully eaten. Derived on read, it puts the agreement on a review list. A prompt for a person, never a trigger — nothing in the system branches on it. |
| **Recovery** | The one action that leaves `lost`, on either channel, routing the piece back to stock, to maintenance, or to retirement. It adds the unit's buying price back to stock value and reverses no money: recognised income stays recognised. The piece keeps its original barcode and its frozen prices. |
| **Availability** | For rentals, a query — a unit is available for a window if no `open` or `handed_over` booking overlaps it. Not a status. A unit may hold several bookings for different windows. |
| **Hand-over** | The moment the piece physically leaves the shop. No money changes hands; it was collected at booking. |
| **Agreement** (`RentalAgreement`) | One unit handed over to one customer, with its own due date, rent-per-day, deposit, and overdue-per-day, snapshotted from the booking. |
| **Group id** | The identifier shared by every booking or agreement created in one counter interaction. Exists so three sarees print one receipt while settling independently. |
| **Deposit** | Security money collected in full at booking, and money held while the booking is live. At settlement, overdue and damage charges are kept from it as income and the remainder is returned, never below zero; on a cancellation it goes back in full; on a write-off the whole of it becomes income. |
| **Overdue-per-day** | The per-day penalty for a late return. Must exceed rent-per-day. |
| **Damage grade** | The picklist entry staff choose at settlement — clean through beyond-repair — each carrying a default charge that pre-fills the deduction and may be overridden. A beyond-repair grade retires the unit. |
| **Maximum rental period** | `floor(deposit / overduePerDay)` days. Derived on read; never stored. |
| **Overdue** | `status == rented AND today > dueDate`. Derived on read; never stored, and never maintained by a job. |
| **Paise** | The storage unit for all money. ₹1,299.50 is `129950`. |
| **Payment reference** | A short, human-readable, sequential code allocated from a Postgres sequence the instant a UPI QR is drawn, and stored on the sale or booking only if it commits. Not an invoice number: an abandoned or cash-switched checkout burns its reference and leaves a harmless gap, which an invoice series (if it ever exists) cannot tolerate under GST. |
| **Sell-through** | Units sold from a lot ÷ units intaken into that lot. A per-lot and per-vendor quality signal. |
| **Utilisation** | For a rental unit, days rented ÷ days owned. |
| **Payback** | For a rental unit, cumulative rental income ÷ buying price. A unit is "paid for" at 1.0. |
| **Final ROI** | The closing figure on a retired or written-off rental unit: lifetime rent plus overdue and damage charges plus any forfeited deposit, minus upkeep, against buying price. Derived at read time, never stored. |
| **Shrinkage** | The buying-price value the shop has written off — counted out on a move into `damaged`, `lost` or `retired`, and counted back in on a recovery out of `lost`, so the figure is always net of recoveries. |
