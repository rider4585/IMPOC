## Epic 9: Expenses

The owner can log shop expenses — category, amount, date, note — with corrections as reversing rows, never an edit. Two stories, both now shipped. **Re-sequenced by Raviraj, this run:** this epic originally also carried the owner dashboard (CAP-22) as a second batch. The dashboard has moved to **Epic 12**, the final epic in the build, so it can be designed once the shop has actually been run and Raviraj knows what is worth showing — see Epic 12's own implementation notes for the full account of what moved and why. Epic 9 now covers CAP-21 (expenses) only; nothing about Stories 9.1–9.2 below changes as a result of that move.

**This epic ships exactly one migration.** Slot 21 creates `expenses` (Story 9.1) — the next open slot after Story 8.4's 20. The Requirements Inventory's migration order lists `customer_erasure_audit` (Epic 10) between `expenses` and `report views`, but this epic ships before Epic 10 per the Epic List's own sequencing rationale; Epic 12 (not this epic, after the dashboard's move) is what claims the next slots for the six AD-13 views, the AD-15 index set, and `user_preferences` — see Epic 12's own implementation notes for that numbering, which now runs independently of this epic's own.

**A pre-existing brownfield permission is knowingly left alone.** `backend/src/constants/permissions.js` already carries `EXPENSES.UPDATE` (`'expenses.update'`), seeded to `MANAGER` and `ACCOUNTANT` before this spine existed. NFR3 and CAP-21 both now say a completed expense is never UPDATEd — corrections are reversing rows — so no route this epic builds ever checks `EXPENSES.UPDATE`, and none ever will. Per AD-4's and AD-10's own non-retrofit stance for pre-existing brownfield surfaces, this story does not remove the constant, revoke the grant, or write a migration touching it — it is left exactly as the original seeder wrote it, becoming an orphaned permission no code path reads, the same way CAP-16's id is retired without being deleted from history. What this story adds instead is `EXPENSES.REVERSE`, the permission the actual correction route checks.

### Story 9.1: Record a shop expense

As an accountant,
I want to log what the shop spent — rent, maintenance, a non-sellable purchase, or upkeep on a specific rental piece — with an amount, a date, and a note,
So that the dashboard's profit figures are built from real spending, not just real sales (FR20/CAP-21, AD-1, AD-2, AD-3, AD-4, AD-6, AD-10, AD-22, AD-29).

**Acceptance Criteria:**

**Given** migration `20-add-deposit-exhausted-on` has already run (Story 8.4)
**When** migration `21-create-expenses` runs
**Then** it creates `expenses` with `id`/`uuid` (AD-1); `category VARCHAR NOT NULL` under a named `CHECK` restricting it to `SHOP_RENT`, `MAINTENANCE`, `NON_SELLABLE_PURCHASE`, `RENTAL_UPKEEP` (AD-3, `domain-model.md`'s exhaustive list); `amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0)` — `expenses.amount_paise` is **not** one of AD-2's closed two negative-value exemptions (`sale_lines.*_paise` on a reversing line, `sales.exchange_difference_paise`), so unlike a reversing sale line, a reversing expense row carries the **same positive amount** as the row it corrects, never a negated one; `incurred_on DATE NOT NULL` (AD-6 — already shop-local, no `AT TIME ZONE` conversion ever applied to it, per AD-14's own table); `note TEXT NOT NULL`; `unit_id INTEGER NULL REFERENCES units(id)`; `reverses_expense_id INTEGER NULL REFERENCES expenses(id)`; `created_by_user_id INTEGER NOT NULL REFERENCES users(id)`; `deleted_at TIMESTAMPTZ NULL` (AD-4, though AD-5's append-only-ledger tier means it is never written on this table); and `created_at`/`updated_at`
**And** a named unique index `expenses_one_reversal` on `expenses(reverses_expense_id) WHERE reverses_expense_id IS NOT NULL AND deleted_at IS NULL` exists (AD-9), added in this same migration exactly as `sales_one_reversal` (Story 5.4) and `rental_agreements_one_open_per_unit` (Story 7.4) were added alongside the tables they guard, not deferred to Story 12.2's AD-15 index migration — that migration is for the fixed reporting-index set AD-15 enumerates, and this reversal guard is a correctness constraint AD-9 requires the moment the table exists, the same distinction that already put `sales_one_reversal` in Epic 5 rather than in this epic
**And** a second named `CHECK` — `expenses_unit_id_matches_category` — enforces `(category = 'RENTAL_UPKEEP' AND unit_id IS NOT NULL) OR (category <> 'RENTAL_UPKEEP' AND unit_id IS NULL)` as a database fact, not only a client-side gate: `domain-model.md` states `unit_id` is "set for `RENTAL_UPKEEP` so upkeep lands against a specific unit's lifetime earnings," which this table treats as mandatory-when-applicable and forbidden otherwise, so a shop-rent row can never accidentally carry a stray unit reference that a later per-unit ledger query would pick up

**Given** `expenses.service.js` and its new `EXPENSE_CREATE` gesture (already enumerated in `gesture-type.js` by Story 1.4/1.7 — this story is simply the first to use it)
**When** `POST /api/expenses` is called with `{ requestUuid, category, amountPaise, incurredOn, note, unitId }`
**Then** the whole gesture runs inside one transaction (AD-10): the service validates `category` against the same constant the DB `CHECK` enforces, validates `unitId` is present if and only if `category === 'RENTAL_UPKEEP'` (mirroring the DB constraint so the error names the mismatch before the `CHECK` violation would, per AD-11's translation existing as the backstop, not the primary UX), inserts the `expenses` row, then inserts the `request_keys` row last — `gesture_type: 'EXPENSE_CREATE'`, `result_kind: 'EXPENSE'`, `result_uuid` the new expense's uuid (AD-22's insert-last ordering)
**And** a replay of the same `requestUuid` performs no second insert and returns the original committed expense with 200, never a duplicate row and never a 409

**Given** a `RENTAL_UPKEEP` expense whose `unitId` does not resolve to an existing, non-deleted unit
**When** `POST /api/expenses` is called
**Then** the request is refused before any write, naming the barcode-less internal reference the client sent as unresolvable — this story imposes no channel restriction on which unit may receive an upkeep expense (nothing in `domain-model.md` or `dashboard-questions.md` limits it to rental-channel units, so none is invented here)

**Given** `GET /api/expenses` and `GET /api/expenses/:uuid`
**When** either is called
**Then** both read the live `expenses` table directly through an ordinary `expenses.service.js` read, **not** through `v_net_expenses` and **not** through `modules/reports/` — AD-12's and AD-13's direct-read ban binds `CAP-22`'s dashboard read side specifically (AD-12's own **Binds:** line names it), not this module's own audit list of what staff entered; a reversed expense and its reversing row **both** appear here, the reversing row visibly pointing at `reversesExpenseId`, exactly as a sale receipt shows a reversed line struck through (UX-DR10) rather than silently removing it — the netted, reversal-free figure is what the dashboard shows, and this list is where a member of staff confirms what they actually entered, so it must show every row, live or reversed
**And** `GET /api/expenses` returns the `{ items, page, pageSize, total }` envelope (AD-26), newest-first, each item carrying `category`, `amountPaise`, `incurredOn`, `note`, `unitId` (when present), `reversesExpenseId` (when present), and the creating user's name — never the actor's internal `id`

**Given** `PERMISSIONS.EXPENSES.CREATE` and `PERMISSIONS.EXPENSES.VIEW` (both pre-existing, already seeded to `ADMIN`, `MANAGER`, and `ACCOUNTANT`)
**When** the two routes above are authorized
**Then** `POST /api/expenses` requires `authenticate` and `authorize(PERMISSIONS.EXPENSES.CREATE)`; the two `GET` routes require `authenticate` and `authorize(PERMISSIONS.EXPENSES.VIEW)` — no new permission constant is introduced by this story, and `EXPENSES.UPDATE` is checked by nothing this story adds

### Story 9.2: Correct an expense with a reversing row

As an accountant,
I want to reverse an expense I recorded wrong, without ever editing the row I entered,
So that the ledger keeps an honest trail of what was actually keyed in and corrected, and the shop's expense total is never quietly rewritten out from under it (FR20/CAP-21, NFR3, AD-9, AD-10, AD-22, AD-29).

**Acceptance Criteria:**

**Given** the pre-existing `EXPENSES.REVERSE` permission does not yet exist
**When** a scoped seeder migration runs
**Then** it adds `EXPENSES.REVERSE` (`'expenses.reverse'`) to `backend/src/constants/permissions.js` under the existing `EXPENSES` group and grants it to exactly `ADMIN`, `MANAGER`, and `ACCOUNTANT` — the same three roles that already hold `expenses.create`/`expenses.view` — and to no other role, per this epic's own implementation notes stating ACCOUNTANT holds the expense permissions and AD-29's matrix leaving `CASHIER` and `INVENTORY_MANAGER` out of `EXPENSES.*` entirely
**And** this migration is scoped to this one permission only, per Story 1.7's and Story 4.4's precedent, not a broader `seed-new-permissions` sweep

**Given** an existing, non-reversed expense (`reverses_expense_id IS NULL` on it, and no other row's `reverses_expense_id` points at it)
**When** `POST /api/expenses/reverse` is called with `{ requestUuid, expenseUuid, note }`
**Then** the whole gesture runs inside one transaction (AD-10): the service reads the original row, and inserts a new `expenses` row copying `category`, `amount_paise`, and `unit_id` from it **exactly** — the client may supply `note` and nothing else — with `reverses_expense_id` set to the original's `id` and `incurred_on` set to today's shop day (AD-6), **never** the original's `incurred_on`; the caller-supplied `note` states why the correction was made, replacing the original row's note on this new row rather than repeating it, since the reversing row's own job is to explain the correction, not restate the mistake
**And** the reversing row's `amount_paise` matches the original's exactly, positive, never negated — the arithmetic that cancels the two out lives in Story 12.1's `v_net_expenses`, which excludes both rows entirely rather than summing a negative against a positive, so nothing here signs the amount for that purpose

**Given** the `expenses_one_reversal` unique index (Story 9.1, AD-9)
**When** `POST /api/expenses/reverse` is called against an expense that has already been reversed
**Then** the insert collides on that partial unique index, `withDbErrors` (AD-11) translates it to a 409 naming the expense and the fact it is already reversed, and no second reversing row is ever written for the same original — this is the database fact that makes "at most one reversal per row" true for expenses exactly as it already is for sales and rental agreements

**Given** the `request_keys` row for this gesture
**When** the transaction above commits
**Then** it is inserted last, `gesture_type: 'EXPENSE_REVERSE'`, `result_kind: 'EXPENSE'`, `result_uuid` the new reversing row's uuid (AD-22's insert-last ordering), and a replay of the same `requestUuid` returns the original committed reversal with 200, performing no second insert and colliding with nothing

**Given** `PERMISSIONS.EXPENSES.REVERSE`
**When** `POST /api/expenses/reverse` is authorized
**Then** it requires `authenticate` and `authorize(PERMISSIONS.EXPENSES.REVERSE)` — a user holding only `EXPENSES.VIEW` (none exists on this matrix, but stated for completeness against AD-29's own splitting principle) cannot reverse an expense they can merely see, and `EXPENSES.CREATE` alone does not imply `EXPENSES.REVERSE` either, even though every role in this build that holds one currently holds both
