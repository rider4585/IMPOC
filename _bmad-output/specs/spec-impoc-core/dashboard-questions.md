# Dashboard question catalog

CAP-22's contract. The dashboard is the headline feature: the owner's whole view of how the shop is doing. Each question below must be answerable on the dashboard for a user-chosen date range (default: today, with this-week / this-month / custom presets). Every figure is derived at read time — nothing in this catalog is a stored column.

The columns are the question in the owner's words, the figure that answers it, and the rows it is computed from.

Most questions take the owner's date range. A few are **point-in-time**: they answer "right now" and ignore the range entirely — Q6, Q7, Q11, Q12, Q15, Q22, Q25 and Q26. Each is marked below. A balance has no date range; it is only ever "now".

---

## Takings and profit

| # | Question | Figure | Computed from |
|---|---|---|---|
| Q1 | What did the shop take in? | Total takings, split into retail sales, rental income, overdue charges, damage/cleaning charges, and forfeited deposits | `SaleLine.transactedPricePaise` for sales in range, minus reversing lines and net of exchange differences. Every rental figure is dated to the booking's **finishing event**, never to the day it was made: `RentalBooking.rentChargedPaise` on bookings that finished in range — at `returnedAt` if settled, `cancelledAt` if cancelled, `writtenOffAt` if written off, exactly one of the three per booking; `RentalAgreement.overdueChargedPaise` and `damageChargedPaise` for settlements in range; the **whole** deposit on bookings written off in range, dated to `writtenOffAt` alone |
| Q2 | How much of that was cash and how much UPI? | Two totals, for till reconciliation at close | `Sale.paymentMethod`; `RentalBooking.paymentMethod`; deposit returns and cash exchange refunds netted out of the cash figure |
| Q3 | What did the shop spend? | Expense total by category, plus stock purchases | `Expense.amountPaise` by category, minus reversals; `StockIntake.totalPaidPaise` for trips in range |
| Q4 | Did the shop make money? | Net position = takings − expenses − stock purchases, for the range | Q1 − Q3 |
| Q5 | What did the shop actually earn on what it sold? | Realised gross margin = Σ(transacted price − buying price) on units sold in range, in rupees and as a % | `SaleLine.transactedPricePaise` − `SaleLine.buyingPricePaise` |
| Q6 | *(point-in-time)* How much deposit money am I holding that is not mine? | Deposit cash held against bookings still `open` or `handed_over` — a liability, never counted in Q1 | Σ `RentalBooking.depositPaise` where the booking state is `open` or `handed_over`, with nothing subtracted. Settlement advances the booking to `settled` in the same transaction that records the return, so the deposit leaves this sum by the state change alone; subtracting `RentalAgreement.depositReturnedPaise` on top of that would drive the figure negative by every deposit ever handed back. Never summed from `RentalAgreement.depositPaise` — that is a settlement snapshot, and a paid booking not yet handed over has no agreement row at all |
| Q25 | *(point-in-time)* How much rent have I been paid for hires that have not finished? | Rent collected on bookings still `open` or `handed_over` — the third bucket. A liability today, income the day each booking finishes; never counted in Q1 and never added to Q1 or Q6 | Σ `RentalBooking.rentChargedPaise` where the booking state is `open` or `handed_over`, with nothing subtracted. Exactly Q6's shape and predicate over the other money column, deliberately, so the two move together. Rent leaves this figure the instant the booking's state leaves those two, at which moment the same amount appears in Q1 on the finishing event's day. **Point-in-time on purpose:** extending a live booking changes its rent, so a range version would retroactively move a number the owner had already read |

## Inventory

| # | Question | Figure | Computed from |
|---|---|---|---|
| Q7 | *(point-in-time)* What is on the floor right now? | Unit count and capital tied up at buying price, broken down by product type and by channel | Units in `in_stock` and `in_maintenance` × `buyingPricePaise`. `reserved` is not a status — a unit with a future booking is on the floor |
| Q8 | What is not moving? | Aging: units `in_stock` more than 30 / 60 / 90 days since intake, listed by lot, type, and vendor | `now − StockIntake.purchasedOn` for units still in stock |
| Q9 | What sells fastest? | Median days from intake to sale, by product type and by lot | `Sale.soldAt − StockIntake.purchasedOn` |
| Q10 | What am I losing to breakage and theft? | Shrinkage, net of recoveries: count and buying-price value of units written off in the range, less anything recovered in it | A signed figure per `UnitStatusEvent` — minus the unit's snapshotted `buyingPricePaise` on a transition **into** `damaged`, `lost` or `retired`, plus the same figure on a recovery **out of** `lost`, zero on every other transition — summed plainly, so a question cannot forget to net a recovery. A `lost → retired` recovery is one row doing both and nets to zero. Recoveries also show separately as Q27 |
| Q27 | What came back after I wrote it off? | Recovery count and value for the range, drillable to who recovered each piece and why | `UnitStatusEvent` rows that are a recovery out of `lost`, valued at the unit's snapshotted `buyingPricePaise`. **Never valued at the netted shrinkage figure** — a `lost → retired` recovery nets to zero, so a recovery line built on it would report a real piece walking back through the door as ₹0. Shrinkage answers "what did the shop lose"; this answers "what came back" |

## Rental

| # | Question | Figure | Computed from |
|---|---|---|---|
| Q11 | *(point-in-time)* What is out on rent right now, and what is due back? | Open agreements, with a due-today and due-this-week list | `RentalAgreement` where `returnedAt is null` |
| Q12 | *(point-in-time)* What is overdue and how much has it eaten? | Overdue units with days late and accrued charge, capped at deposit | Derived: `rented AND today > dueDate`; `overdueDays × overduePerDayPaise` |
| Q26 | *(point-in-time)* Which pieces have eaten their whole deposit and need a decision? | Review list of live agreements past the day their deposit runs out, with the customer, the days late, and the deposit it has consumed — the screen a person opens to decide whether to write the piece off | Derived on the read: `dueDate + floor(depositPaise / overduePerDayPaise)` days, over agreements that are neither returned nor written off. Both operands are snapshots on the agreement, so the date never shifts under a later edit. **The date is a prompt, never a trigger** — nothing branches on it beyond whether a row appears in this list: no status changes, no money moves, no row is written when it passes |
| Q13 | Which rental pieces earn their keep? | Per unit: cumulative rental income, damage charges collected, upkeep spent against it, and payback ratio against buying price | (Σ `rentChargedPaise` + Σ `damageChargedPaise`) per unit − Σ `Expense` where `unitId` matches, ÷ `buyingPricePaise` |
| Q14 | How hard is the rental stock working? | Utilisation: days booked ÷ days owned, per unit and averaged per product type | Booking date ranges vs `StockIntake.purchasedOn` |
| Q15 | *(point-in-time)* What is in the workshop? | Units in `in_maintenance`, how long they have been there, and upkeep spend on them | Unit status + `RENTAL_UPKEEP` expenses |
| Q22 | *(point-in-time)* What is booked but not yet collected? | Open bookings by collection date, with rent and deposit already taken | `RentalBooking` where state is `open` |
| Q23 | What did a retired piece finally earn? | Final ROI per unit retired or written off in range: lifetime rent + overdue + damage charges + any forfeited deposit − upkeep, against buying price | Derived, never stored. A written-off piece's closing figure is dated to `writtenOffAt` and includes **the rent and the whole deposit** — the two the write-off forfeits together. A unit reaching `lost` is not itself the anchor |

## Vendor and lot

| # | Question | Figure | Computed from |
|---|---|---|---|
| Q16 | Which vendor's stock actually sells? | Sell-through % (units sold ÷ units intaken) and realised margin, per vendor and per lot | Units per `StockIntakeLine`, joined to sale lines |
| Q17 | What have I paid each vendor? | Total paid per vendor over the range, with per-trip breakdown | `StockIntake.totalPaidPaise` grouped by vendor |
| Q18 | Do my trip records add up? | Variance per trip between recorded total paid and Σ(lot quantity × buying price) | `StockIntake.totalPaidPaise` − Σ line cost |

## Floor behaviour

| # | Question | Figure | Computed from |
|---|---|---|---|
| Q19 | Are we discounting away the margin? | Average discount off selling price, and count of sales within 5% of floor price, by cashier and by product type | `SaleLine.transactedPricePaise` vs unit `sellingPricePaise` and `floorPricePaise` |
| Q24 | How much is coming back? | Exchange count and net difference collected or refunded, by cashier and product type | `Sale.exchangeOfSaleId` and `exchangeDifferencePaise` |
| Q20 | Who is selling? | Sales count and value per cashier for the range | `Sale.soldByUserId` |
| Q21 | New faces or regulars? | New vs returning customer counts and average basket value for each | `Customer` first-sale date vs sales in range, matched on `Sale.customerId`. **Never on `whatsappNumber`** — that number is released on erasure, so matching on it detaches an erased customer's history and merges the next person to reuse the number into it |

---

## Rules that bind the dashboard

- Reversing rows are netted out of every takings, margin, and expense figure. A reversed sale must not show anywhere as revenue.
- **Rental money sits in three buckets, shown separately and never added together:** earned income (Q1's rental part), deposits held (Q6), and rent held (Q25). Every paise the shop has taken on a booking is in exactly one of them at any instant, and the booking's state change is the single event that moves it.
- **Neither held bucket ever appears in takings.** Rent becomes income at the booking's finishing event, dated to that event's own day — never to the day the booking was made. A booking still `open` or `handed_over` contributes nothing to Q1.
- **A booking finishes in exactly four ways and no others**, and each names what becomes income and when: returned clean → rent + any overdue, at `returnedAt`; returned damaged and settled → rent + any overdue + the damage kept, at `returnedAt`; cancelled before hand-over → the rent, forfeited, at `cancelledAt`, with the deposit returned in full and never income; written off → the rent **and the whole deposit**, at `writtenOffAt`, with nothing returned.
- **A forfeited deposit has exactly one anchor: `writtenOffAt`.** A unit reaching `lost` — with a live agreement or without one — is an audit fact and never an income anchor. Two anchors for one deposit is how the same money gets counted twice.
- **A written-off booking raises no separate overdue charge.** The overdue is what ate the deposit; counting the deposit and the overdue would count the same money twice, and it is the likeliest mistake on this path because the overdue figure is on the very screen the write-off is triggered from.
- **Q1 and Q2 will not match on any given day, and that is correct.** Q1 is income; Q2 is the till. Cash arrives at booking and income is recognised at the finish, so a day of three new bookings and no returns fills the drawer without moving the income figure. They reconcile over a booking's life, never inside one day of it. A builder who meets this mismatch must not "fix" it by recognising rent at booking again — that reverts the decision and reopens everything it closes. Any reconciliation check is written against the three buckets plus cash movements, never against Q1 alone.
- The deposit liability (Q6) and the rent-held figure (Q25) are sourced from `RentalBooking` and from nothing else. Both are collected at booking, so summing agreements understates the drawer by every booking that is paid but not yet handed over — and double-counts every one that has been handed over.
- Nothing is ever deducted from either held figure. Money leaves Q6 and Q25 in exactly one way — the booking's state leaves `open`/`handed_over`, whether by settlement, cancellation, or the piece being written off. `depositReturnedPaise` is a cash-movement figure and its only reader is Q2's till reconciliation.
- Rent is collected up front and is never pro-rated. What the finishing event moves is *recognition*, not cash: no customer is charged or refunded because a booking closed.
- **A recovery reverses stock value and never money.** Q10 nets it, Q27 shows it, and no income figure anywhere is un-recognised by it. The mirror image — reversing the income and leaving the stock written off — is wrong in both halves.
- An exchange nets: the reversed line comes out of takings and the new line goes in, leaving only the difference. A reversed sale must not show anywhere as revenue.
- Q23's final ROI is computed at read time like everything else. Retirement does not write a stored ROI column.
- Every figure must be drillable to the rows behind it — a total the owner cannot open into its lines is not an answer.
- Q12 and Q26 must both be correct on page load with no job having run. If any part of this catalog tempts a cron, the query is wrong, not the constraint.
- Q26's date decides only whether a row is listed. Nothing else in the system may branch on it.
- Q21 counts returning customers. It does not price, reward, or segment them — loyalty is a non-goal.
