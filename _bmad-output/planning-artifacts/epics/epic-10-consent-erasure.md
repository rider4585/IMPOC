## Epic 10: Customer Data Consent & Erasure

An admin can erase a customer's personal data on request while every past transaction still shows correct totals. Written in one run (Stories 10.1–10.5). The epic covers a single capability, CAP-24, and there is nothing in it worth splitting across batches: one table, one gesture, one screen, one verification pass, and the audit that proves the whole thing happened — that audit (Story 10.3) now covers the historical half of that proof only, per this run's own re-sequencing note below; the reporting half moved to Epic 12's Story 12.10.

**It is its own epic despite covering one capability because it is a compliance action, not a sub-feature of checkout.** CAP-13's consent capture already ships inside Story 5.3, where it belongs — a cashier records consent while the customer is standing at the counter. What this epic ships is the other half of the promise CAP-13's consent block makes: that the shop can honour a request to erase. That request arrives weeks later, from an administrator, through no counter gesture at all, and it is answered against a legal obligation rather than a sale. Folding it into Epic 5 would have made it look like a checkout feature and buried the one property the whole capability turns on — that erasure never touches a completed transaction.

**Erasure is a supersede-safe UPDATE on exactly one row, and never a history rewrite.** The erasure clears `name`, `whatsapp_number`, `date_of_birth` and `email` on the `customers` row and releases the WhatsApp number so a future customer may use that number (AD-18). The name and number **already copied onto past sales and rental agreements** — `customer_name_snapshot` and `customer_whatsapp_snapshot`, written at commit time by Story 5.4 and Story 7.1 — are left completely untouched. That is what keeps `SPEC.md`'s never-UPDATE-a-completed-transaction constraint absolute rather than nearly absolute, and it is what keeps every past receipt reproducible byte for byte. AD-5 settles the same point from the other direction: `customers` is **mutable master data**, a tier that permits an ordinary UPDATE, so erasing it breaches nothing; `sales`, `sale_lines` and the two rental tables sit in tiers that forbid the write this epic is often mistakenly imagined to need. The two facts are the same fact seen twice.

**This epic changes no other module's read path — but Story 10.3 verifies that rather than assuming it, for every read path that exists by the time this epic ships.** The claim rests on every historical read already joining to snapshotted values, never live to `customers`. Epics 5 through 8 were written that way deliberately, as are the five operational dashboard questions this run's re-sequencing carried into Epics 4, 7, and 8 alongside them. If any of those reads does join live to `customers` for a name or a number, that is a defect **this epic fixes**, in Story 10.3, not a note it files for someone else. Q21, which matches new-vs-returning customers on the customer's internal `id` rather than `whatsapp_number` so that an erased customer's purchase history stays correctly attached and correctly anonymous at once, does not exist until Epic 12 — **Epic 12's Story 12.10** is where that property is verified for Q21 specifically, and where the equivalent claim is completed for the six AD-13 views and the remaining 22 dashboard questions this epic cannot reach.

**Epic 10 ships exactly one numbered migration — slot 22** — plus one scoped, unnumbered permission seeder. `22-create-customer-erasure-audit` (Story 10.1) takes **22**, the next open slot after Epic 9's `21-create-expenses` (Story 9.1). **Re-sequenced by Raviraj, this run:** the owner-dashboard work that used to sit in this epic's predecessor — the six AD-13 views, the AD-15 index set, and `user_preferences` — has moved out to **Epic 12**, the final epic in the build, so it no longer claims slots between this epic's migration and Epic 9's. Before this run, this migration took slot 25, landing after those three (slots 22–24 under the old numbering) even though the Requirements Inventory's own prose lists `expenses → customer erasure audit → report views → report indexes → user preferences`, in that order — a mismatch this epic's own notes previously had to explain away with "the prose describes dependency order, not a literal reservation of migration numbers." With Epic 12 moved to the end of the build, this epic now ships directly after Epic 9, so the actual build order finally matches the Requirements Inventory's prose without that caveat, and this migration's slot moves from 25 to 22 to reflect it. `customer_erasure_audit`'s FK targets — `customers` (Story 5.3, slot 14) and `users` (pre-existing) — have both existed since Epic 5, so nothing about the slot moving changes what the table can reference. **This is the note Epic 9's now-expenses-only epic and Epic 12's own implementation notes both point back to** for the full renumbering; Epic 12's three migrations now take slots 23–25, immediately following this one.

**This epic alters no existing table.** Story 5.3 already created `customers.erased_at` and `customers.erased_by_user_id` and stated plainly that they exist "so Epic 10's erasure work alters no table, only `customers.service.js`'s own behaviour." That holds: slot 22 creates one new table and touches nothing else.

**One column-shape conflict is resolved here rather than inherited.** AD-18's rule text says erasure sets `name` to NULL, but Story 5.3 created `customers.name` as `VARCHAR NOT NULL`, and Story 5.4 justified `sales.customer_name_snapshot NOT NULL` on exactly that guarantee. Both cannot stand as written. Story 10.2 resolves it in favour of a fixed non-personal sentinel value rather than dropping the `NOT NULL` — the reasoning is in that story's own acceptance criteria, and it turns on `whatsapp_number` needing the opposite treatment for a reason specific to its partial unique index. `domain-model.md` and CAP-24 both say "anonymised" rather than "nulled", which the sentinel satisfies. `ARCHITECTURE-SPINE.md`'s AD-18 text must be corrected to say so.

**One deliberate extension to AD-22's enumerated gesture set.** AD-22 lists fourteen mutating gestures and states that adding a mutating gesture without adding its `gesture_type` is a reviewable violation. Erasure is a mutating gesture and is not on that list — it was missed, the same way `RENTALS.EXTEND` had no verb on AD-29's matrix until CAP-25 surfaced the gap. Story 10.1 adds `CUSTOMER_ERASE` explicitly and records the addition, so the set is extended on the record rather than silently.

### Story 10.1: The erasure surface — one audit table, one admin-only permission, one new gesture type

As a developer,
I want the audit table, the permission and the gesture type that erasure needs to exist before any erasure route does,
So that the gesture Story 10.2 builds has a place to record itself, a permission to check, and an entry in AD-22's enumerated set rather than a quiet exemption from it (FR23/CAP-24, AD-1, AD-4, AD-5, AD-9, AD-18, AD-22, AD-29).

**Acceptance Criteria:**

**Given** migration `21-create-expenses` has already run (Story 9.1, Epic 9)
**When** migration `22-create-customer-erasure-audit` runs
**Then** it creates `customer_erasure_audit` with `id`/`uuid` (AD-1); `customer_id INTEGER NOT NULL REFERENCES customers(id)` — who requested the erasure, recorded **by reference only**; `erased_by_user_id INTEGER NOT NULL REFERENCES users(id)` — who performed it; `erased_at TIMESTAMPTZ NOT NULL DEFAULT now()` — when; `deleted_at TIMESTAMPTZ NULL` (AD-4, though AD-5's append-only-ledger tier means it is never written on this table); and `created_at`/`updated_at`
**And** this migration takes slot **22**, matching the Requirements Inventory's raw migration order exactly, per this epic's own implementation notes above (re-sequenced from slot 25 by this run, now that Epic 12's dashboard migrations no longer land between this one and Epic 9's) — both of its foreign-key targets have existed since Epic 5, so the slot changes nothing about what it can reference

**Given** the table's whole purpose is to record that an erasure happened without recording what was erased
**When** its columns are reviewed
**Then** it carries **no personal-data column of any kind** and no free-text column of any kind: no copy of the erased `name`, `whatsapp_number`, `email` or `date_of_birth`; no `erased_values` JSONB or equivalent "for audit" snapshot; and **no `note`, `reason` or `requested_via` TEXT column** — a free-text box on an erasure record is precisely where a person types the customer's name back in, which would defeat the erasure the table exists to attest to (AD-18: an audit row records `customer_id`, actor, and timestamp, and "**never the erased values**")
**And** an automated test asserts the table's column list matches that set exactly, so a later story cannot add a helpful-looking note field without the test failing

**Given** AD-9's "make it a database fact" pattern, already applied as `sales_one_reversal`, `expenses_one_reversal` and `rental_agreements_one_open_per_unit`
**When** the same migration runs
**Then** it also creates a named partial unique index `customer_erasure_audit_one_per_customer` on `customer_erasure_audit(customer_id) WHERE deleted_at IS NULL` — "at most one erasure per customer" becomes a database fact rather than a service-layer check, and it is what turns a retried erasure into a 409 Story 10.2 can translate rather than a silently duplicated audit row

**Given** AD-5's tier table, which already names `customer_erasure_audit` in its **append-only ledger** tier
**When** the model is written
**Then** it is INSERT-only: never UPDATEd, never soft-deleted, and it has **no reversing-row correction path at all** — unlike `sales` or `expenses`, an erasure has nothing to reverse, because the personal data it destroyed is gone and no row anywhere can restore it; the tier is read from AD-5's own table, not inferred, and AD-5's "exhaustive over migrations 03–20 and 23" wording covers this table by name regardless of its slot having moved, first to 25 and now, by this run's re-sequencing, to 22

**Given** the `CUSTOMERS.ERASE` permission does not yet exist — Story 5.3 deliberately left it out of its own `CUSTOMERS` seeder, stating it is "`ADMIN`-alone (AD-29) and is seeded by Epic 10 when erasure is built"
**When** a scoped seeder migration runs
**Then** it adds `customers.erase` to `backend/src/constants/permissions.js` under the existing `CUSTOMERS` group and grants it to **no role explicitly at all** — `ADMIN` receives it through its existing `Object.keys(permissionMap)` assignment, which is the whole mechanism by which AD-29's "`ADMIN` holds `CUSTOMERS.ERASE` and `SETTINGS.MANAGE`, which **no other role holds**" is expressed; writing an explicit `ADMIN` grant here would duplicate that assignment and invite a later reader to add `MANAGER` beside it
**And** this migration is scoped to this one permission only, per Story 1.7's, Story 4.4's and Story 9.2's precedent, not a broader `seed-new-permissions` sweep
**And** an automated test asserts that `MANAGER` — the role that holds every other money-and-customer power on AD-29's matrix and is therefore the easiest one to wrongly grant this to — does **not** hold `customers.erase`, alongside `CASHIER`, `INVENTORY_MANAGER` and `ACCOUNTANT`

**Given** AD-22's enumerated set of fourteen mutating gestures, which does not include erasure
**When** `backend/src/constants/gesture-type.js` is updated
**Then** it gains `CUSTOMER_ERASE` as a fifteenth entry, and `result_kind` gains `CUSTOMER` — erasure is unambiguously a mutating gesture, and AD-22's own rule that "adding a mutating gesture without adding its `gesture_type` is a reviewable violation" is satisfied by adding it here on the record, not by exempting erasure from AD-22
**And** `ARCHITECTURE-SPINE.md`'s AD-22 gesture list is updated to name `CUSTOMER_ERASE`, exactly as AD-29 records `RENTALS.EXTEND` being added when CAP-25 surfaced the gap it left — the spine states the set is enumerated so that a new gesture cannot quietly opt out, which only holds if the spine's own list is the one that grows

**Given** this story
**When** its full migration footprint is reviewed
**Then** it is exactly one numbered migration (slot 22) plus one scoped seeder, and **no `ALTER TABLE` of any kind** — `customers.erased_at` and `customers.erased_by_user_id` were both created by Story 5.3's slot-14 migration for this epic to write into, so no existing table is touched by this epic at all

### Story 10.2: Erase a customer — one UPDATE, one audit row, and nothing else

As an administrator,
I want to erase a customer's name, WhatsApp number, date of birth and email on their request,
So that the shop honours the erasure request while every receipt it has already issued still prints exactly as it printed on the day (FR23/CAP-24, AD-1, AD-5, AD-6, AD-9, AD-10, AD-11, AD-18, AD-22, AD-24, AD-29).

**Acceptance Criteria:**

**Given** a customer that has not been erased
**When** `POST /api/customers/:uuid/erase` is called with `{ requestUuid }` — no other body field exists, since the audit table has nothing else to record
**Then** the whole gesture runs inside one transaction (AD-10) and writes exactly three rows: **one UPDATE** on the `customers` row setting `whatsapp_number = NULL`, `email = NULL`, `date_of_birth = NULL`, `name` to this story's sentinel, `erased_at = now()` and `erased_by_user_id` to the acting admin; **one INSERT** into `customer_erasure_audit` carrying that customer's `id`, the same actor, and the same timestamp; and **one INSERT** into `request_keys`, last, with `gesture_type: 'CUSTOMER_ERASE'`, `result_kind: 'CUSTOMER'`, `result_uuid` the customer's own uuid (AD-22's insert-last ordering)
**And** the response carries the customer's `uuid`, `erasedAt`, and the performing user's name — never the internal `id` of either (AD-1), and never any of the values it just cleared

**Given** AD-18's rule text says `name` is set NULL, while Story 5.3 created `customers.name` as `VARCHAR NOT NULL` and Story 5.4 justified `sales.customer_name_snapshot NOT NULL` on exactly that guarantee
**When** the service performs the UPDATE
**Then** `name` is set to a **fixed, non-personal sentinel** — a single shared constant, not a per-row generated string and not a value derived from anything about the customer — rather than to NULL, and the `NOT NULL` constraint stands unchanged: dropping it would weaken a column three earlier stories lean on and would let a future capture-time bug write a nameless customer, whereas a fixed sentinel holds no personal data at all and satisfies CAP-24's and `domain-model.md`'s own wording, which is "anonymised", not "nulled"
**And** `whatsapp_number` is set to **NULL and never to a sentinel**, which is the opposite treatment for a reason specific to that column: AD-18's release of the number depends on `UNIQUE (whatsapp_number) WHERE whatsapp_number IS NOT NULL AND deleted_at IS NULL` not matching NULLs, and a shared sentinel string would collide with itself the second time any customer was erased
**And** `ARCHITECTURE-SPINE.md`'s AD-18 rule text is corrected to state the sentinel for `name` and NULL for `whatsapp_number`, so the spine and the schema agree

**Given** AD-18's retention rule
**When** the UPDATE runs
**Then** `consent_given_at` and `consent_purpose` are **left exactly as they were** — they hold no personal data and are the proof that consent existed, which is the half of CAP-24 that survives the erasure and the reason Story 10.4 can still show it
**And** `deleted_at` is **never set** on the customer row: the row, its `id` and its `uuid` all survive so every foreign key stays intact, and soft-deleting it would strand every `sales.customer_id` and `rental_bookings.customer_id` pointing at it and break Q21's lifetime first-sale match

**Given** the customer has past sales and past rental bookings or agreements
**When** the erasure commits
**Then** **not one byte** of `sales.customer_name_snapshot`, `sales.customer_whatsapp_snapshot`, `rental_bookings.customer_name_snapshot`, `rental_bookings.customer_whatsapp_snapshot` or the same pair on `rental_agreements` is read, written or considered — the gesture's entire write footprint is the three rows above
**And** an automated test records a sale and a rental booking for a customer, captures the exact receipt payload Story 6.1's `assembleSaleReceipt` returns and the exact PDF bytes Story 6.2 streams, erases the customer, re-requests both, and asserts they are **identical byte for byte** — this is the test that makes "erasure never breaches the never-UPDATE-a-completed-transaction constraint" a checked fact rather than a claim in a document

**Given** AD-19's cold start, which instructs the client to retry a request whose response was lost
**When** the same `requestUuid` is replayed
**Then** the replay collides on `request_keys_gesture_request`, `withDbErrors` (AD-11) reads back `result_kind`/`result_uuid`, and the original committed result is returned with **200** — no second audit row, no second UPDATE, and no 409
**And** this is why erasure carries a `requestUuid` at all despite being naturally repeatable: without one, the retry AD-19.1 mandates would collide on `customer_erasure_audit_one_per_customer` and report a successful erasure to the administrator as "already erased" — the exact shape of failure AD-22 exists to prevent, one gesture replayed rather than two gestures racing

**Given** a customer already erased, and a **different** `requestUuid` — a genuinely new request, not a retry
**When** `POST /api/customers/:uuid/erase` is called
**Then** the INSERT collides on `customer_erasure_audit_one_per_customer` (Story 10.1, AD-9), AD-11 translates it to a **409** naming the customer's uuid and the date they were erased, the whole transaction rolls back, and no second audit row is ever written — the UPDATE itself would have been harmless to repeat, but a second audit row would misreport one erasure as two, and the audit table's only job is to be an accurate count of what happened

**Given** an erased customer's former WhatsApp number
**When** `GET /api/customers/by-whatsapp/<that number>` is called (Story 5.3's route, unchanged by this story)
**Then** it returns 404 naming the number as not on file — no code change is needed for this, because the number is already NULL, and CAP-24's "an erased customer cannot be found by their old WhatsApp number" therefore holds by construction rather than by a filter someone must remember to write
**And** `POST /api/customers` with that same number creates a **new, distinct** customer with its own `id` and `uuid`, colliding with nothing (Postgres does not match NULLs) — Story 5.3 already asserted this against a hypothetically erased row; this story is the first that can produce a genuinely erased one, so the test is re-run against the real route and the hypothetical is retired

**Given** a customer with no sales, no bookings and no agreements at all
**When** they are erased
**Then** the gesture behaves identically — same three rows, same response — with no special case for the empty-history path, and no error

**Given** the gesture in full
**When** its reach is reviewed
**Then** it calls `units.service.transitionUnit()` **not at all**, writes no `unit_status_events` row, reads and writes no `units`, `sales`, `sale_lines`, `rental_bookings`, `rental_agreements` or `expenses` row, and moves no money in any direction — erasure has no counterpart anywhere in the unit lifecycle or the three money buckets, and nothing here should be built as though it might

**Given** `PERMISSIONS.CUSTOMERS.ERASE`
**When** the route is authorized
**Then** it requires `authenticate` and `authorize(PERMISSIONS.CUSTOMERS.ERASE)`, and an automated test confirms a `MANAGER` — who holds `CUSTOMERS.VIEW` and `CUSTOMERS.CREATE` and can see the customer perfectly well — receives 403, per AD-29's `ADMIN`-alone assignment

### Story 10.3: Prove that no historical read joins live to `customers`

As a developer,
I want the claim this whole epic rests on checked against every historical read path that exists at the time this epic ships, and any read that breaks it fixed here,
So that "erasure changes no other module's read path" is a verified property of the codebase rather than an assumption inherited from a design document, for every read path this run's re-sequencing leaves within this epic's reach (FR23/CAP-24, AD-18, AD-24).

**Split by this run, Raviraj's re-sequencing:** this story originally audited both the historical read side (receipts, sale reads, settlement slips) and the reporting read side (the six AD-13 views and the 27 dashboard questions) in one pass. The dashboard has moved to **Epic 12**, the final epic in the build, so the six views and 27 questions do not exist yet when this epic ships — they cannot be audited here. This story now covers the historical half only, which is fully verifiable at this point in the build; **Epic 12's Story 12.10** is the reporting half, split out explicitly rather than left as an unstated gap. Five dashboard questions — Q11, Q12, Q15, Q22, Q26 — were also carried out of the dashboard epic by this same run, each into the epic that already owns the table it reads (Epic 4, Epic 7, and Epic 8); those five **are** covered here, since they exist by the time this epic ships, alongside the rest of this epic's audit list.

**Acceptance Criteria:**

**Given** AD-18's binding read rule — "no receipt, sale view, agreement view, or dashboard figure may join to `customers` to obtain a name or number"
**When** every historical read path that exists by the time this epic ships is audited against it
**Then** the audit covers, by name and one at a time: Story 6.1's `assembleSaleReceipt` and Story 6.2's PDF renderer; every sale read in `modules/sales/`; Story 7.5's hand-over receipt; Story 8.1's settlement slip; and the five operational dashboard questions this run's re-sequencing carried into their own epics — Story 4.5 (Q15), Story 7.6 (Q22), Story 8.4 (Q12, Q26), and Story 8.6 (Q11) — **not** the six AD-13 views or the remaining 22 dashboard questions, which belong to Epic 12's Story 12.10 because neither exists yet
**And** the audit's result is recorded in the story's own completion notes as a list of every path checked, so a later reader can tell the difference between "checked and clean" and "not looked at" — and so that Epic 12's Story 12.10 can point back to this list rather than re-describing it

**Given** any read in that list found to join live to `customers` for a name or a number
**When** the audit finds it
**Then** **it is a defect this story fixes** — repointed at the transaction row's own `customer_name_snapshot`/`customer_whatsapp_snapshot` (AD-24), with the fix landing inside this story and not filed as a follow-up — and the fix is accompanied by a test proving that path's output is unchanged by an erasure
**And** the two joins AD-18 explicitly **permits** are left exactly as they are and are not counted as defects: Story 5.3's capture-time lookup by WhatsApp number, and Story 10.4's customer-own-details screen

**Given** this epic has no reports module of its own to guard yet — `modules/reports/questions/` holds only the five files named above, none of which reference `customers` (audited in this same pass)
**When** this story adds a repo-level guard test
**Then** it fails the build if any file under `backend/src/modules/reports/` — the five existing files today, and any file added under that path by a later epic — or any receipt or settlement-slip assembler references the `customers` table or the `Customer` model at all, in a join or otherwise; because the guard is a pattern match over the directory rather than an enumerated file list, it automatically covers Epic 12's six views and remaining 22 questions the moment that epic adds them, with no second guard test needed there — Epic 12's Story 12.10 re-runs this guard against its own, by-then-complete `modules/reports/` tree as its own proof, rather than duplicating the assertion
**And** this guard ships **even if the audit above finds zero defects**: the guard is this story's actual deliverable, because the property it protects is one a single well-meant join in a future epic silently destroys, and the fix would be invisible until the day a customer asks to be erased

**Given** the reconciliation test this story's original scope described — recomputing every range-scoped dashboard figure for a shop day before and after a customer's erasure and asserting the two reconcile to the paise
**When** this story is scoped
**Then** it does **not** ship that test — no range-scoped dashboard figure exists to recompute until Epic 12 builds the dashboard, dashboard or no re-sequencing, so the test is Epic 12's Story 12.10 to write, not this story's; this story's own closing proof is narrower by necessity, not by choice, and Story 12.10 states explicitly that this is the one piece of the original story's scope that could never have landed here under any sequencing

### Story 10.4: The customer's own details screen, with consent shown as proof

As an administrator,
I want one screen showing a customer's current details and the consent they gave — including after erasure — so that the shop can demonstrate that a customer agreed to their details being held, and can show that the erasure was carried out (FR23/CAP-24, FR13/CAP-13, AD-1, AD-6, AD-18, AD-29; UX-DR15).

**Acceptance Criteria:**

**Given** AD-18's carve-out that `customers` is joinable "for lookup at capture time (CAP-13) and for the customer's own current-details screen"
**When** `GET /api/customers/:uuid` is added
**Then** it is the second and last route in the system that reads the live `customers` table, and it returns `uuid`, `whatsappNumber`, `name`, `email`, `dateOfBirth`, `consentGivenAt`, `consentPurpose`, `erasedAt`, and the erasing user's **name** — never the internal `id` of the customer or of any user (AD-1)
**And** it requires `authenticate` and `authorize(PERMISSIONS.CUSTOMERS.VIEW)`, the permission Story 5.3 already seeded to `CASHIER` and `MANAGER`, so no new permission is introduced by this story
**And** an unknown or non-existent uuid returns 404 naming the reference as not on file

**Given** a customer who has not been erased
**When** the screen renders
**Then** the consent block is presented as **proof, not as a setting**: the stated purpose exactly as it was captured, and the timestamp rendered in shop time (AD-6) as a plain date and time, plainly labelled as when the customer agreed — this is CAP-24's "the shop can show that a customer agreed to their details being held", and it is the first screen in the system that shows it, since Story 5.3 captured the three values and nothing has displayed them since

**Given** a customer who **has** been erased
**When** the same screen renders
**Then** the name field shows Story 10.2's sentinel and the number, email and date-of-birth fields render as explicitly empty rather than as blank space that reads like a loading state
**And** the consent block is **still shown in full**, above an explicit statement naming the date the personal details were erased and the administrator who performed it — the consent record was deliberately retained (AD-18) and this is where its retention becomes visible, so that a request to demonstrate both consent and its honouring is answered on one screen

**Given** the scope of this story
**When** its boundaries are reviewed
**Then** it adds **no purchase-history panel** — a sale is already reachable by its own reference through Story 6.1's receipt route, and no story so far needs a per-customer transaction list; if one is ever added it must match on `customer_id` and read `customer_name_snapshot`, never match on `whatsapp_number` and never re-derive a name from this row (AD-18, Q21), and Story 10.3's guard test is what would catch it doing otherwise
**And** it adds **no edit route**: neither CAP-13 nor CAP-24 gives a customer's details an amendment path, so no `PATCH /api/customers/:uuid` is invented here, and the screen is read-only apart from the erase action Story 10.5 adds to it

### Story 10.5: The erase action — admin-only, confirmed once, absent for everyone else

As an administrator,
I want to trigger the erasure from the customer's own screen, after a confirmation that tells me in plain words exactly what will and will not change,
So that a permanent action is taken deliberately and by the only role entitled to take it (FR23/CAP-24, AD-2, AD-19, AD-22, AD-29; UX-DR13, UX-DR16, UX-DR19).

**Acceptance Criteria:**

**Given** the customer screen from Story 10.4 and AD-29's closing rule that "a withheld gesture is *absent*, not disabled"
**When** a user without `CUSTOMERS.ERASE` opens it — a `CASHIER` or a `MANAGER`, both of whom hold `CUSTOMERS.VIEW`
**Then** the erase control is **not rendered at all**: no greyed-out button, no tooltip explaining why, nothing (UX-DR16) — and an automated test asserts its absence for `MANAGER` specifically, the role most likely to be assumed to hold it

**Given** an administrator on a not-yet-erased customer's screen
**When** they trigger the erase control
**Then** a confirmation panel appears before anything is sent, modelled on Story 4.4's recovery panel (UX-DR13), stating in plain words both halves of what happens: that this customer's name, WhatsApp number, date of birth and email will be cleared and their number will become available to a different person; and that their past receipts, past rental agreements and every rupee figure the shop reports are **unchanged** and will keep showing the name and number as they were at the time
**And** the panel names the specific customer currently on screen (UX-DR19 — no bare "Are you sure?"), states that the action cannot be undone, and keeps the commit control disabled until an explicit confirmation is given

**Given** the audit table deliberately carries no free-text column (Story 10.1)
**When** the confirmation panel is designed
**Then** it carries **no reason or note field** — there is nowhere to store one, and a free-text box on this particular panel is the single most likely place in the whole system for a person to type the customer's name back into a record that exists specifically to hold none

**Given** Epic 5's shared frontend module, which owns the `requestUuid` (AD-22), the cold-start banner and backoff (AD-19.1), and the collection envelope (AD-26)
**When** the erase call is made
**Then** it goes through that module like every other mutating gesture and not through its own bare `fetch`: one UUIDv4 generated before the first attempt and reused unchanged across every retry of this gesture, and the waking banner shown on a cold start rather than an error
**And** a retry that succeeds on the second attempt renders as a plain success — never as "already erased" — because Story 10.2's replay path returns the original result with 200

**Given** a successful erasure
**When** the response arrives
**Then** the screen re-renders in place as Story 10.4's erased state — sentinel name, empty contact fields, consent block retained, erasure statement shown — with no navigation away and no message claiming that rows were deleted, because none were
**And** the confirmation panel's text, which named the customer, is discarded rather than left on screen or in any client-side cache behind the re-render

**Given** a 409 from Story 10.2 — the customer was already erased, by someone else or in an earlier session
**When** the client receives it
**Then** it shows the date the erasure was performed rather than a generic failure (UX-DR19), and re-renders the screen in its erased state, since the outcome the administrator wanted is already the case

**Given** the shape of this action
**When** its scope is reviewed
**Then** **no bulk erase exists** — one customer, one confirmation, one gesture. CAP-24 describes a request from a person about their own details, a bulk path has no counterpart anywhere in the capability, and a single mis-click on one would be unrecoverable across every row it touched
