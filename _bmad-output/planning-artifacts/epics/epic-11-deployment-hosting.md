## Epic 11: Deployment & Hosting Readiness

The shop can reach the app from the counter over the open internet, on free-tier hosting, with a written way back if the database is lost. Written in one run (Stories 11.1–11.9). It covers no capability directly, and it is the one epic organized by technical necessity rather than end-user value — everything the previous ten epics built is unreachable until this one lands, which is also the argument for it closing the list rather than opening it. That argument is revisited, and partly contradicted, in this epic's own notes below. **Re-sequenced by Raviraj, this run:** this epic is no longer the final epic in the build — **Epic 12** (the owner dashboard) now follows it, moved to the very end so it can be designed once the shop has actually run. This epic remains the one that makes everything reachable, and Epic 12 remains the one epic that ships after the shop is live rather than before; the two are not in tension, since Epic 12's own work happens against an already-deployed system, deliberately.

**This epic closes the last two parked decisions in the spine's `Deferred` section and defers neither again.** The section currently holds four items; two of them — *"Which free hosts"* and *"Backup and restore procedure"* — are answered here, and both bullets are deleted from the spine rather than reworded. The remaining two (*frontend state management and routing*, *receipt delivery channel*) were closed elsewhere: the first by Story 5.1's `platform` module, the second by Story 6.3, and neither is this epic's business. **"Revisit before the first deploy" and "revisit when the hosting provider is chosen" both mean here.** There is no later epic to hand them to.

**Epic 11 ships no numbered migration at all — no table, no column, no index, no seeder, no permission.** Epic 9 took slot **21** for `expenses` and Epic 10 took slot **22** for `customer_erasure_audit` (re-sequenced from 25 by this run — see Epic 10's own implementation notes), so **23** is the next open slot at the point this epic ships, and this epic leaves it open. Unlike the numbering this epic's notes described before this run, that next slot is **not** one this epic itself ever claims: Epic 12, moved to the end of the build after this one by Raviraj's decision, claims slots 23–25 (the six AD-13 views, the AD-15 index set, `user_preferences`) once it ships, after this epic. What Epic 11 does with migrations is run the ones that already exist against a real host for the first time, and fix the two things about *how* they are run that no earlier epic could settle without knowing the host: which connection string executes them (Story 11.4) and the fact that `down()` never executes against the deployed database once it has (Story 11.8). It is the only epic in the list with an empty migration footprint, and that is the correct shape for it.

**Story 11.1 is a verification story, not a paperwork story.** Naming a provider is a sentence; the story is not the sentence. AD-19 fixes three hard requirements on whichever managed Postgres is eventually chosen — `CREATE EXTENSION btree_gist` permitted, the IANA timezone database present, and both a pooled and a direct connection string exposed — and every one of the three is a thing vendors describe accurately in documentation and inaccurately in free-tier reality. The story therefore closes with the extension actually created on the actual database by the actual migration file, the actual `AT TIME ZONE 'Asia/Kolkata'` returning an actual Indian date, and both actual strings actually connecting. A screenshot of a pricing page satisfies none of it.

**AD-19's four numbered consequences are split across four stories rather than bundled, because each one fails differently.** Consequence 1 (cold start) was built in Epic 5 — Story 5.1's `platform` module already owns the retry, the backoff and the waking banner, and this epic adds only the endpoint the external monitor pings (Story 11.3). Consequence 2 (ephemeral filesystem) becomes a proof that no write path exists anywhere (Story 11.5). Consequence 3 (pooled connections) becomes both a configuration and a list of things the code may never do, because a transaction-mode pooler breaks *silently*, under load, weeks later (Story 11.4). Consequence 4 (the health endpoint) is Story 11.3's other half. Bundling them would have produced one story nobody can mark done.

**One ambiguity in AD-30 is resolved here rather than inherited.** AD-30 says every log line carries "a request id" and that "the id AD-22's replay path logs is the same one, so investigating a suspected duplicate sale is one `grep`." Those two clauses pull apart the moment a cold start causes a retry. A per-HTTP-request id is *different on every attempt* — three attempts at one checkout produce three ids, which is exactly the situation AD-30 says it exists to prevent. The id that survives a retry is the client's `requestUuid` (AD-22), which Story 5.1's `platform` module generates once per gesture and reuses unchanged across every attempt. Story 11.7 settles it: the logged `requestId` **is** the gesture's `requestUuid` whenever the call carries one, and a server-generated id only when it does not. That is the only reading under which the grep AD-30 promises actually returns all the attempts. `ARCHITECTURE-SPINE.md`'s AD-30 text must be corrected to say so.

**HTTPS is treated as a hard requirement in this epic, not as a hosting nicety.** `frontend/AGENTS.md` states the reason plainly: `vite.config.js` sets `basicSsl()` and `host: true` deliberately, because `getUserMedia` refuses to run outside a secure context, so the camera scanner cannot work over a plain `http://` LAN address. The camera scanner is the product — CAP-1 through CAP-3 and every counter gesture in Epics 3, 5, 7 and 8 start with a scan. A deployment that serves the SPA over HTTP does not degrade; it removes the app's primary input device. Story 11.6 makes that a deployment gate rather than a README paragraph.

**Story 11.9 proves AD-16 rather than trusting it.** AD-16 is written as a *checkable* prohibition — it names `node-cron`, `node-schedule`, `agenda`, `bull`, `bullmq`, `bree` and `cron` as examples and says explicitly that the list is "examples, not the definition." A prohibition whose enforcement is "we all remember it" survives exactly until the first person who does not know it opens a terminal. Story 11.9 converts it into a test that fails a build, and it checks the three distinct ways a scheduler actually arrives: as a dependency, as a `setInterval` someone added to a service file, and as a second process entry point declared in the host's own service configuration where no `package.json` grep would ever see it.

### Implementation note — Story 11.1 is a strong candidate to be pulled forward into Epic 1

**Recorded as a trade-off for Raviraj to decide, not as a change already made.** As the list is sequenced today, Story 11.1 runs last. That means the hard requirement the entire rental availability design rests on — that the chosen host permits `CREATE EXTENSION btree_gist` — is proven against the real host only *after* eleven epics have been built on top of the assumption that it holds.

The failure mode is specific and expensive. Local development almost certainly runs against a Postgres that permits the extension (a local install, or a container image, where the developer is superuser). AD-7's generated `daterange` column and its partial `EXCLUDE` constraint will work perfectly for the entire build. If the eventually-chosen provider forbids the extension, the failure appears at the very end, and what has to be rebuilt is not a migration — it is AD-7 itself, and with it every rental availability read, the booking overlap guard, and the parts of Epics 7 and 8 that depend on the database refusing a double-booking rather than the service layer checking for one. AD-20 already anticipated the shape of this by making `01-enable-btree-gist` "first and alone, so a host that forbids the extension fails loudly on step one rather than fifteen tables in" — but *first among migrations* only helps if those migrations have been run somewhere that can say no. Locally, nothing says no.

**The case for moving it:** Story 11.1 has no dependency on any other story in the list. It needs migration `01-enable-btree-gist` to exist, which is Story 1.1, and nothing else — not `app_settings`, not `request_keys`, not a single route. It could run as Story 1.2 and would answer the riskiest open question in the architecture on day two instead of day two hundred.

**The case for leaving it:** it is real setup work — accounts, connection strings, a deploy pipeline — at the moment when the fastest path to a working scanner is a local Postgres and `npm run dev`. Front-loading it spends the first day of the project on hosting rather than on the defect that stops barcodes printing correctly today.

**The middle option, if the full story is too much to move:** pull forward only its first acceptance criterion — create a free database on the candidate provider and run `CREATE EXTENSION btree_gist` against it by hand — and leave the rest of Story 11.1 where it is. That is fifteen minutes of work, it needs no deploy pipeline and no application code, and it retires the one risk that cannot be absorbed late. **This is the recommended action if the decision is not made deliberately either way.**

### Story 11.1: Choose the hosting provider and prove AD-19's three hard requirements on the real host

As a developer,
I want the three hosting providers named, and each of AD-19's three hard database requirements verified by running against the actual chosen database rather than by reading its documentation,
So that the extension the entire rental availability design depends on is known to install *before* anything else depends on it having installed (NFR16, AD-7, AD-19, AD-20; closes the spine's *"Which free hosts"* deferral).

**Acceptance Criteria:**

**Given** AD-19's deployment shape — backend on a free container host, Postgres on a free managed provider, frontend as a static build on a CDN host — which the spine deliberately fixed without naming vendors
**When** the selection is made
**Then** all three are named explicitly in `ARCHITECTURE-SPINE.md` under AD-19, with the **selected** provider and a **named fallback** for each, so that a provider changing its free tier is a substitution rather than a reopened decision:
| Role | Selected | Fallback | The property that decides it |
| --- | --- | --- | --- |
| Managed Postgres | **Neon** (free serverless Postgres) | Supabase | Both a transaction-mode pooler host and a direct host; PG 15+; `btree_gist` installable by the tenant |
| Backend container | **Render** (free web service) | Fly.io | Spins down and returns on demand, HTTPS terminated at the edge, stdout captured as logs |
| Static frontend | **Cloudflare Pages** | Netlify | HTTPS by default on the served origin, no cold start, SPA fallback routing |
**And** AD-19's own description of the envelope is already written against exactly this shape — "a free container host spins down after ~15 minutes idle and takes 30–60 s to return; a free serverless Postgres autosuspends after ~5 minutes and resumes in under a few seconds" — so the selection is a confirmation of the assumed behaviour, and **any candidate whose behaviour differs materially from those two sentences invalidates AD-19.1's client-side retry design and must be raised rather than silently accepted**

**Given** that every free tier's terms change, and that the three requirements below are the ones vendors describe accurately in documentation and inaccurately in practice
**When** the selection is evaluated
**Then** no requirement is accepted on the strength of a documentation page, a pricing table, or a support reply — **each of the three is proven by executing something against the provisioned database**, and the story is not complete until all three have been

**Given** the first hard requirement — `CREATE EXTENSION btree_gist` must be permitted (AD-7)
**When** it is verified
**Then** migration `01-enable-btree-gist` (Story 1.1) is run against the provisioned database **as the application's own database user, not as a superuser or an owner role that will not be used at runtime** — the extension being installable by *somebody* is not the requirement; it being installable by the credentials in `DATABASE_URL` is
**And** `SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist'` returns a row, and its version is recorded alongside the provider name in AD-19
**And** the proof goes further than the extension existing: **a throwaway table carrying a generated `daterange` column and a partial `EXCLUDE USING gist` constraint in AD-7's exact shape is created, two overlapping rows are inserted, and the second is refused by the database** — because a provider can permit `CREATE EXTENSION` and still restrict `EXCLUDE` constraints or `gist` index creation, and the requirement is not the extension, it is the refusal
**And** the throwaway table is dropped afterwards, leaving only migration 01 applied

**Given** the second hard requirement — the IANA timezone database must be present, or `AT TIME ZONE 'Asia/Kolkata'` errors and every shop-day figure in AD-6, AD-13 and AD-14 breaks
**When** it is verified
**Then** `SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date` is executed against the provisioned database and returns the correct Indian calendar date — not an error, and not a UTC date
**And** `SELECT count(*) FROM pg_timezone_names WHERE name = 'Asia/Kolkata'` returns 1
**And** the check is run **at a UTC hour where the two dates actually differ** — between 18:30 and 23:59 UTC, when India is already on the following day — because run at midday UTC the query returns the right date whether the conversion happened or not, and a check that passes for the wrong reason is worse than no check

**Given** the third hard requirement — both a transaction-mode pooler string and a direct string must be exposed, or AD-19.3's split between application connections and migration connections has no host to run on
**When** it is verified
**Then** both connection strings are obtained from the provider's own dashboard, and **both are proven to connect independently** — `SELECT 1` succeeds on each, from the machine that will run the deploy
**And** the two are confirmed to be *actually different endpoints* rather than the same host under two labels: their hostnames differ (on Neon the pooled host carries a `-pooler` suffix), and `SHOW server_version` succeeds on both
**And** `SELECT current_setting('server_version_num')::int >= 150000` returns true — AD-19 and the Stack table both target **Postgres 15 or later**; 13 is the spine's stated true floor for `gen_random_uuid()` and trusted extensions, but 15 is the target and a provider offering only 13 or 14 is a fallback, not the selection

**Given** the pooler is transaction-mode, which is the constraint Story 11.4 builds on
**When** the pooled string is verified
**Then** it is confirmed to be **transaction** mode and not session mode, by opening two sequential statements outside a transaction and observing that `SELECT pg_backend_pid()` may return different backends — this is not a defect to work around, it is the property Story 11.4's prohibitions exist to respect, and confirming it here is what makes those prohibitions non-negotiable rather than cautious

**Given** the environment variables the rest of this epic refers to
**When** the deployment configuration is written
**Then** exactly two database variables exist and are named unambiguously: **`DATABASE_URL`** — the pooled string, used by the running application and by nothing else — and **`DIRECT_DATABASE_URL`** — the direct string, used by migrations and by nothing else
**And** both carry `sslmode=require`, and neither is ever committed to the repository in any form; `.env.example` carries the two names with empty values and a comment naming which is which

**Given** the spine's `Deferred` section, which currently reads *"Which free hosts. AD-19 fixes the shape and the four consequences that bind code, deliberately without naming vendors. Revisit before the first deploy."*
**When** this story completes
**Then** that bullet is **deleted from `Deferred`**, not amended in place, and AD-19 carries the provider table, the verified `btree_gist` version, and the verified Postgres major version — a decision recorded in the section for undecided things is still an undecided thing to the next reader

### Story 11.2: The backup and restore procedure — written down, with a named person who runs it

As the shop owner,
I want the backup provider, frequency, retention window and the named person who performs a restore written down before the first real sale is recorded,
So that the answer to "the database is gone" is a document rather than a conversation held under pressure (NFR16, AD-17, AD-19, AD-20; closes the spine's *"Backup and restore procedure"* deferral).

**Acceptance Criteria:**

**Given** that this decision binds no line of code and no table — which is precisely why it was parked, and precisely why it will never be closed by any story that also has code to write
**When** this story is worked
**Then** its entire deliverable is a written procedure, and the absence of code is not a reason to treat it as optional or to defer it a third time — **it is closed here**

**Given** the four things the spine's `Deferred` bullet names as outstanding — provider, backup frequency, retention window, who executes a restore
**When** the procedure is written
**Then** all four are answered concretely, with no "TBD", no "as appropriate", and no range where a value belongs:
1. **Provider and mechanism** — the selected Postgres provider's own point-in-time restore, if the free tier includes it, **plus** an independent `pg_dump` taken against `DIRECT_DATABASE_URL`; the second exists because the first is a feature of an account that could be suspended, and a backup that lives only inside the thing being backed up is not a backup
2. **Frequency** — stated as a specific cadence, chosen against the shop's actual tolerance for lost work measured in *sales*, not in hours; a shop recording twenty transactions a day loses a different amount to a weekly dump than to a daily one, and the number chosen is written down with that reasoning beside it
3. **Retention** — a specific number of days, with the oldest-retained backup's age stated plainly, so "how far back can we go" has a number
4. **Who executes a restore** — a **named person**, not a role and not "the developer"; and a named second person, so the procedure survives the first one being unreachable

**Given** that `pg_dump` cannot be run by anything inside this repository — AD-16 forbids the scheduler that would trigger it, and AD-19.2 forbids the filesystem it would write to
**When** the backup mechanism is specified
**Then** it is explicitly **external to this repository**: a developer machine, or the provider's own scheduled backup, in the same category as AD-16's exemption for "an external uptime monitor hitting a health endpoint"
**And** the procedure states in one sentence that adding a backup job to `backend/package.json` is forbidden by AD-16 and that Story 11.9's test will fail the build if anyone tries — because a backup job is the single most defensible-sounding reason anyone will ever have to add a scheduler, and the prohibition needs to answer it by name

**Given** that a restore is a procedure nobody has practised
**When** the document is written
**Then** it contains the **restore** steps, not only the backup steps: where the dump is, the exact command to load it, which connection string to load it through (`DIRECT_DATABASE_URL` — the pooler will not carry a restore), and how the application is pointed at the restored database afterwards
**And** the restore has been **performed once, against a scratch database, by one of the two named people**, and the document records the date it was rehearsed — an unrehearsed restore procedure is a hypothesis

**Given** AD-17's minute-stamped barcode prefix, whose stated purpose is preventing "a database restore reissuing a number that is already printed on a label sitting on the counter"
**When** the restore procedure is written
**Then** it states explicitly that **`barcode_seq` needs no manual rewind or fast-forward after a restore** — Story 1.6's boot-time guard refuses to issue any barcode until the current Postgres minute exceeds `max(left(barcode, 7))` over `units`, so a restored database cannot reissue a printed number no matter how far back it was restored from
**And** it states the one operational consequence a person would otherwise be confused by: **immediately after restoring to a point more than a minute in the past, barcode generation is blocked until wall-clock time catches up to the newest restored label** — this is the guard working correctly, it is self-clearing, and it must not be "fixed" by resetting the sequence
**And** this closes the `Deferred` bullet's own remark that the backup decision's "one code-binding consequence was the barcode rewind, and AD-17's minute prefix makes that collision structurally impossible" — confirmed here against the guard as Story 1.6 actually built it, rather than assumed

**Given** what a restore of *this* database costs in a shop
**When** the document is written
**Then** it names the two things that do not come back with the rows, so nobody discovers them mid-restore: **printed barcode labels on physical stock** whose `units` rows are older than the restore point are now unrecognised by the scanner and must be re-scanned into their lots; and **receipts already handed to customers** for sales lost by the restore have no matching row, which matters because AD-19.2 and the spine's *"saved receipt" resolved* note mean no PDF bytes exist anywhere to reconcile against — the receipt is reproducible from rows, and rows that were rolled back reproduce nothing

**Given** the spine's `Deferred` section
**When** this story completes
**Then** the *"Backup and restore procedure"* bullet is **deleted from `Deferred`**, and the procedure lives in the repository as an operational document referenced from AD-19 — this is the second and last of the two bullets this epic removes, leaving `Deferred` holding only the two items closed elsewhere

### Story 11.3: `GET /api/health` — unauthenticated, no database round trip, and the monitor that pings it

As a developer,
I want a health endpoint that answers instantly without touching Postgres, and an external monitor pinging it,
So that the container host stays warm without the ping waking the autosuspended database it is supposed to leave alone (NFR16, AD-16, AD-17, AD-19.1, AD-19.4).

**Acceptance Criteria:**

**Given** AD-19.4's statement that "the backend serves `GET /api/health`, unauthenticated, mounted in `app.js` outside every module"
**When** the endpoint is added
**Then** it is registered directly in `backend/src/app.js`, **before the authentication middleware and before every module's router**, and it does not live in a module — there is no `health/` directory under `backend/src/modules/`, because a health check that sits behind anything is checking that thing rather than the process
**And** it returns **200** with a small fixed JSON body — process uptime and the current server time, nothing more — and specifically **no** version string read from a file, no dependency list, and no configuration echo

**Given** AD-19.4's reason for the endpoint existing at all — "a health check that queries Postgres wakes the autosuspended database on every ping and defeats the free tier it exists to work around"
**When** the handler is written
**Then** it performs **no database round trip of any kind**: no `SELECT 1`, no `sequelize.authenticate()`, no pool statistics that provoke a connection, and no ORM call whatsoever
**And** an automated test proves it rather than asserting it — the test spies on the Sequelize instance (or the underlying `pg` pool) and asserts **zero** queries were issued across a request to `/api/health`, so a later "improvement" that adds a connectivity check fails the test that exists to stop exactly that improvement

**Given** that "is the database reachable" is a genuinely useful thing to know, and that the reason it is excluded here will be forgotten
**When** the handler is written
**Then** a comment on the route states in one line why no database check belongs here, naming AD-19.4 — and if a database-touching check is ever genuinely needed it is a **separate, differently-named, non-pinged** endpoint, never this one, and never this one with a query parameter

**Given** the endpoint is unauthenticated and publicly reachable
**When** its exposure is reviewed
**Then** it leaks nothing: no stack traces, no environment name, no connection strings, no row counts, and no user information — and it is rate-limitable at the host if it is ever abused, which is possible only because it holds no state and touches nothing

**Given** AD-16's exemption — "keep-warm pinging against free-tier idle (AD-19) is an **external** uptime monitor hitting a health endpoint. It is not code in this repo and does not breach this rule."
**When** the monitor is configured
**Then** it is set up **outside this repository** on an external uptime service, pinging `GET /api/health` on an interval shorter than the container host's idle-spin-down window (AD-19.1 states ~15 minutes, so a 5–10 minute interval), and the service and interval are recorded in the deployment document alongside Story 11.2's procedure
**And** **no scheduling code enters this repository to achieve it** — no self-ping, no `setInterval` warming loop, no "keep-alive" module; Story 11.9's test would fail on any of them, and the exemption in AD-16 is worded to permit the external monitor and nothing else

**Given** Story 1.6's boot-time barcode guard, which queries `max(left(barcode, 7))` over `units` at process start
**When** the container cold-starts — which on a free tier is a routine event that happens several times a day, not an edge case
**Then** the guard **does not block the process from binding its port and answering `/api/health`**: the health endpoint responds 200 while the guard is still resolving, because a container host that health-checks the port before routing traffic would otherwise fail the deploy on a database that is itself still waking
**And** the guard resolves **once per process** and its result is held for the process's lifetime, so it costs one query per cold start rather than one per barcode request
**And** if the guard has not yet resolved when a barcode request arrives, that request waits for it — the guard's protection is not weakened to make boot faster; only `/api/health` is exempted, and only because it deliberately touches nothing

**Given** AD-19.1's cold-start contract, which Story 5.1's `platform` module already implements client-side
**When** this endpoint is added
**Then** it changes **nothing** in that module: the waking banner, the backoff and the retry stay driven by the actual API call the counter gesture is making, and the client does **not** poll `/api/health` to decide whether the server is awake — a health probe that succeeds tells the client nothing about whether the request it actually cares about will, and adding that round trip would put a second call in front of every scan

### Story 11.4: Two connection strings — pooled for the app, direct for migrations, and the session state nothing may depend on

As a developer,
I want the application to connect through the transaction-mode pooler with a small Sequelize pool while migrations run on the direct string, and every session-dependent construct banned,
So that the app does not exhaust the free tier's connection limit and does not break in the specific, silent, weeks-later way that transaction-mode pooling breaks code written for a dedicated connection (NFR16, AD-6, AD-10, AD-19.3, AD-20).

**Acceptance Criteria:**

**Given** Story 11.1's two verified environment variables
**When** the database configuration is written
**Then** the running application connects using **`DATABASE_URL`** — the pooled string — and **never** the direct one; and the migration runner connects using **`DIRECT_DATABASE_URL`** and **never** the pooled one
**And** the split is expressed in configuration that a person cannot get wrong by copying a line: the migration configuration reads `DIRECT_DATABASE_URL` explicitly and **fails to start if it is unset**, rather than falling back to `DATABASE_URL` — a silent fallback would run migrations through the pooler, which is the failure this split exists to prevent

**Given** AD-19.3's rule that "Sequelize's own pool is kept small (`max: 5`) because the pooler, not Sequelize, does the multiplexing"
**When** the Sequelize instance is constructed
**Then** its pool is configured with **`max: 5`**, `min: 0`, and a bounded `acquire` and `idle`, with `min: 0` stated deliberately — a warm minimum holds connections open against a database that autosuspends after ~5 minutes idle, which is a connection the free tier charges for and a database that never gets to sleep
**And** the value 5 is not raised to solve a slow query; if the pool is exhausted the diagnosis is a slow transaction (AD-10 forbids anything slow inside one), and **the transaction is the defect, not the pool size**

**Given** AD-19.3's binding rule that "nothing in the code may depend on session state surviving between statements"
**When** the codebase is reviewed and a guard test is written
**Then** three constructs are absent from `backend/src/` entirely, each for the same reason — the pooler hands the next statement a different backend, so any state set on one statement is simply gone by the next:
1. **No `SET LOCAL` outside a transaction**, and no `SET` (session-level) anywhere at all; `SET LOCAL` *inside* an explicit transaction is permitted, because a transaction-mode pooler pins one backend for the transaction's duration, which is exactly the guarantee `SET LOCAL` needs and the only one it gets
2. **No session-level advisory locks** — `pg_advisory_lock` and `pg_advisory_unlock` are forbidden outright; the transaction-scoped variants exist but are not needed, because AD-8's compare-and-swap and AD-7's `EXCLUDE` constraint are the system's two race guards and neither takes an application lock
3. **No `LISTEN` / `NOTIFY`** — both ends require a persistent session, neither survives the pooler, and there is nothing in the system that wants them since AD-16 forbids the background worker that would be listening

**Given** AD-6's rule that shop time is `Asia/Kolkata` and every day boundary is computed in Postgres via `AT TIME ZONE`
**When** the connection configuration is written
**Then** the session timezone is **never set on connect** — no `SET TIME ZONE 'Asia/Kolkata'`, no Sequelize `timezone` option pointing at it, and no connection-level default of any kind. This is the single most likely session-state mistake in this codebase: setting it once at connect and then dropping the explicit `AT TIME ZONE` from queries looks like a tidy-up, works perfectly on a local dedicated connection, and produces **UTC day boundaries on a randomly varying subset of requests** in production, silently mis-bucketing dashboard figures by one day near midnight
**And** the guard test asserts no timezone is set at the connection or session level, and AD-6's inline `AT TIME ZONE 'Asia/Kolkata'` remains the only mechanism, exactly as every dashboard view in Story 12.1 was written

**Given** that a transaction-mode pooler cannot carry named prepared statements across statements
**When** the driver configuration is reviewed
**Then** the `pg` driver is confirmed to be issuing unnamed statements — its default — and no code path passes a `name` to a query, so nothing depends on a prepared statement persisting on a backend it will not see again
**And** if the selected provider's pooled string requires a connection parameter to declare pooling behaviour, it is present on `DATABASE_URL` and recorded in `.env.example`

**Given** AD-10's rule of one transaction per counter gesture with nothing slow inside it
**When** the pooling configuration is reviewed against it
**Then** the two are noted as reinforcing rather than independent: with `max: 5` and a transaction-mode pooler, a transaction that holds a backend while doing something slow blocks a *shared* resource, so AD-10's "nothing slow inside it" stops being a style preference and becomes the thing keeping five connections sufficient for a whole shop floor

**Given** a deployment where the two strings have been swapped by mistake — the single most plausible configuration error in this story
**When** the application starts
**Then** it is caught rather than tolerated: the application logs, at boot, which host it connected through (host only — never the credentials), so a deploy that came up on the direct string is visible in the first log line rather than discovered when the connection limit is hit at the counter

### Story 11.5: Nothing writes to the filesystem — receipts and label sheets stream, and a test proves no write path exists

As a developer,
I want every generated document to stream to the HTTP response with no bytes ever reaching disk, and a test that proves no write path exists anywhere in the backend,
So that a PDF is never written to a filesystem that will not survive the next cold start, and never read back from one that has already forgotten it (NFR16, AD-19.2, AD-24; CAP-1, CAP-15).

**Acceptance Criteria:**

**Given** AD-19.2 — "Barcode PDFs and receipts stream to the HTTP response. Nothing is written to disk, and no generated artefact is ever read back from disk."
**When** every document-producing path is reviewed — Story 1.5's A4 barcode label sheet, Story 6.2's A5 receipt, Story 6.3's WhatsApp delivery, Story 8.4's settlement slip
**Then** each one pipes its `pdfkit` document directly to `res` with the appropriate `Content-Type` and `Content-Disposition`, and **none** of them writes a temporary file, a cache file, or an output file at any point
**And** `bwip-js` output is held as a buffer and passed to `pdfkit` in memory, never via a path

**Given** that "we do not write files" is a claim that decays the moment someone needs a file
**When** the guard test is written
**Then** it fails the build on any occurrence, anywhere under `backend/src/`, of a filesystem **write or read-back** call: `fs.writeFile`, `fs.writeFileSync`, `fs.appendFile`, `fs.createWriteStream`, `fs.mkdir`, `fs.rename`, `fs.copyFile`, `fs.unlink`, and any use of `os.tmpdir()` or a hard-coded `/tmp` path
**And** the test permits **read-only** access to files that ship with the repository — a font file `pdfkit` loads, a template — because those are build artefacts present in the image, not generated state; the prohibition is on *writing*, and on reading back anything written at runtime
**And** the test is written against the source tree rather than against behaviour, because a write path that is only reached on an error branch is exactly the one that will never appear in a passing test run

**Given** the same prohibition applies to inbound files
**When** the routes are reviewed
**Then** **no upload path exists**: no `multer` disk storage, no `express-fileupload`, no `express.static` serving a writable directory, and no route accepting a file — nothing in CAP-1 through CAP-27 uploads anything, and the closing note in the spine's `Deferred` section confirms it deliberately, recording that no document-image column exists on `rental_agreements` because no identity document is ever captured
**And** no logging transport writes to a file — AD-30 permits stdout only, which Story 11.7 configures

**Given** the spine's *"saved receipt" resolved* note — "the rows are durable and the document regenerates identically on demand from snapshots; no PDF bytes are persisted, consistent with AD-19.2"
**When** the receipt route is reviewed against it
**Then** the same request issued twice produces a **byte-identical** document, and the test asserting it uses only values snapshotted at commit time (AD-24) — the reproducibility is what makes storing nothing safe, and the two facts stand or fall together
**And** the response carries no caching header that would let an intermediary hold a receipt containing a customer's name and number

**Given** that the no-filesystem-write prohibition has been in force since Epic 1, and that Epic 12 (the owner dashboard, re-sequenced by this run to ship after this epic rather than before it) will add its own reports module and question files later
**When** the guard test first runs across the codebase as it stands at the end of this epic
**Then** any existing violation found in Epics 1 through 10 is **fixed here**, in this story, rather than filed as a note for someone else — this is the story that owns the claim, and a note would leave the deployment broken in precisely the way the free tier does not report
**And** because the guard is a source-tree pattern match rather than a one-time check, it runs again automatically against Epic 12's later commits with no update needed here — a dashboard question file that somehow wrote to disk would still fail this same test the day it was added, not go unnoticed until this story is reread

### Story 11.6: HTTPS is a deployment gate, because the camera will not open without it

As a shop user,
I want the app served over HTTPS everywhere, including the local network address I open on the counter tablet,
So that the camera scanner works at all — because a browser refuses `getUserMedia` outside a secure context, and every counter gesture in this system begins with a scan (NFR16, AD-19; `frontend/AGENTS.md`).

**Acceptance Criteria:**

**Given** `frontend/AGENTS.md`'s statement that "`vite.config.js` sets `basicSsl()` and `host: true` deliberately — `getUserMedia` requires HTTPS, so the camera scanner cannot work over plain `http://` on a LAN address. Keep both, and expect the self-signed-cert warning."
**When** the deployment is configured
**Then** HTTPS is treated as a **functional requirement of the scanner**, not as a hosting default that happens to be on: the SPA is served over HTTPS by the static host, and the API is reachable over HTTPS only
**And** the reason is recorded in the deployment document in one sentence, because "HTTPS because security" invites someone to weigh it against convenience, whereas "HTTPS or the camera does not open" cannot be weighed against anything

**Given** the SPA is served over HTTPS and calls the API
**When** the API origin is configured
**Then** it is an `https://` origin — a page served over HTTPS calling an `http://` API is blocked as mixed content by every current browser, so an HTTP API does not degrade the app, it stops it
**And** the frontend's API base URL comes from a build-time environment variable, is `https://` in the deployed build, and there is no code path that constructs an `http://` API URL

**Given** the backend runs behind the container host's TLS-terminating proxy
**When** Express is configured
**Then** `app.set('trust proxy', 1)` is set, so `req.protocol` and `req.ip` reflect the original client rather than the proxy — this matters for Story 11.7's logs, which are the only diagnostic this system has
**And** any request arriving over plain HTTP is redirected to HTTPS at the edge or refused, never served

**Given** the counter tablet and phone run the app on the shop's own network during development and testing
**When** local development is run
**Then** `basicSsl()` and `host: true` stay in `vite.config.js` exactly as `frontend/AGENTS.md` requires, the self-signed certificate warning is expected and accepted on each device once, and **neither is removed to silence the warning**
**And** the deployment document states that a device which has not accepted the certificate will show the scanner as broken rather than as untrusted, since a blocked `getUserMedia` surfaces as a camera that never starts

**Given** the API is called from a different origin than the one serving the SPA
**When** CORS is configured
**Then** the allowed origin is an explicit allowlist of the deployed frontend origin (and the local development origin), **never `*`** — the API is authenticated and carries every customer record in the system
**And** any credential the browser holds is configured for cross-origin use correctly and consistently with that allowlist

**Given** a deploy that comes up on HTTP by misconfiguration
**When** it is verified
**Then** the deployment checklist's scanner step is what catches it: **open the deployed URL on an actual phone and scan an actual label**, before the deploy is called done — every automated check in this epic can pass against a build whose camera never opens, and this is the one step that cannot

### Story 11.7: Structured JSON logs on stdout, and one id that survives a retry

As a developer,
I want every log line to be JSON on stdout carrying one request id, with the idempotency replay path logging that same id,
So that a suspected duplicate sale is answered with one `grep` rather than by reading a cold-start retry storm line by line (NFR19, AD-19.1, AD-22, AD-30).

**Acceptance Criteria:**

**Given** AD-30's rule — "one logger module emits structured JSON to stdout. No transport, no external service, no outbound HTTP call — the container host captures stdout and that is the whole delivery mechanism"
**When** `backend/src/lib/logger.js` is written, at the path the spine's source tree already names
**Then** it emits **one JSON object per line to stdout**, with a fixed field set — timestamp, level, message, `requestId` — and no other logging mechanism exists anywhere in `backend/src/`
**And** `console.log` is absent from `backend/src/` entirely, enforced by a lint rule rather than by review — AD-30's stated failure is a retry storm being unreadable "under `console.log`", and one stray call in a service is enough to reintroduce it
**And** **no error-tracking vendor is adopted**, per AD-30's explicit statement that "it would be the only outbound dependency in the system" — and no log transport package is added, which would also be an outbound dependency and would additionally be a background process AD-16 forbids

**Given** AD-30's two clauses — that every line carries "a request id", and that "the id AD-22's replay path logs is the same one, so investigating a suspected duplicate sale is one `grep`" — which pull apart the moment a cold start causes a retry, since a per-HTTP-request id differs on every attempt
**When** the request id is defined
**Then** it is resolved as this epic's implementation notes state: **`requestId` is the gesture's `requestUuid`** (AD-22) whenever the incoming call carries one, and a server-generated UUID only when it does not — a read, or a request that predates the middleware
**And** the field is named `requestId` in **both** cases, so one `grep` matches regardless of origin — a scheme that named them differently would be correct and useless
**And** the reasoning is that Story 5.1's `platform` module generates one `requestUuid` per gesture and reuses it unchanged across every retry of that gesture, so it is the only id in the system that survives an AD-19.1 backoff — which is the exact condition AD-30 says the id exists to make readable
**And** `ARCHITECTURE-SPINE.md`'s AD-30 is updated to state this explicitly, in the same way Story 10.1 extended AD-22's gesture list on the record rather than leaving the spine describing something the code does differently

**Given** the request-id middleware
**When** a request arrives
**Then** the id is resolved once, attached to the request, and included on **every** line emitted while handling it — the completion line, any service-level line, and the error middleware's line
**And** the completion line carries method, path, status, duration in milliseconds, and the acting user's id where one exists — **never** the acting user's name, and never any customer name, WhatsApp number, email or date of birth, since a log line is a place personal data survives an AD-18 erasure that cannot reach it
**And** the id is returned to the client on an `X-Request-Id` response header, so a person reporting a problem from the counter can read the id off the screen rather than being asked to reproduce it

**Given** AD-22's replay path — where a repeated `requestUuid` returns the original committed result with 200 rather than committing a second time
**When** a replay is served
**Then** it logs a line at the **same** `requestId`, explicitly marked as a replay, naming the `gesture_type` and the `result_uuid` returned
**And** the original commit logged a line at that same id when it happened, so `grep <requestUuid>` over the container host's log output returns the whole story of that gesture in order: the attempts that timed out on a cold start, the one that committed, and every replay since — **which is the one `grep` AD-30 promises**
**And** a test asserts that a commit followed by a replay of the same `requestUuid` produces two lines sharing one `requestId`, with exactly one of them recording a commit — this is the assertion that would fail if anyone later reverts `requestId` to a per-HTTP-request value

**Given** an unhandled error
**When** the error middleware handles it
**Then** it logs one JSON line at the request's id including the error name, message and stack, and the **response body carries no stack trace** — the stack goes to stdout where the container host holds it, and the client gets the shaped error Story 1.8's Zod-and-`next(error)` convention already defines
**And** AD-11's centrally translated constraint violations log the **constraint name** that fired, since that name is the whole mechanism by which a database refusal becomes a diagnosable domain error

**Given** the container host's log retention on a free tier is short and is not a backup
**When** the logging is documented
**Then** the deployment document states the retention window plainly beside Story 11.2's procedure, so nobody plans an investigation around logs that have already rolled off — and states that the durable record of what happened is `request_keys` and the transaction rows themselves, not the log

### Story 11.8: Migrations are forward-only once hosted

As a developer,
I want `down()` to remain written for local development and to be structurally incapable of running against the deployed database,
So that a correction in production is a new forward migration rather than a rollback against a free tier with no convenient restore (AD-19, AD-20).

**Acceptance Criteria:**

**Given** AD-20's rule — "`down()` is written for local development and is never executed against a deployed database; a mistake in production is corrected by a new forward migration"
**When** the migration policy is written down
**Then** it states both halves, because dropping either produces a wrong outcome: `down()` **continues to be written** for every migration, exactly as Story 1.1 through Story 10.1 wrote them, since a developer iterating locally needs it; and it is **never run** against the deployed database
**And** the reason is recorded in one line — AD-20's own "a free tier gives no convenient restore" — so the rule is not mistaken for orthodoxy someone can argue with

**Given** that "never run it" is a rule about a command a tired person types at 9pm
**When** the deploy pipeline is configured
**Then** the deploy step runs the **forward** migration command only, and no rollback, undo or reset command appears anywhere in `package.json` scripts, the deploy configuration, or the deployment document — a rollback script that exists will eventually be run
**And** any convenience script that drops or recreates the schema is either absent or unmistakably named for local use and refuses to run when pointed at a non-local host

**Given** the migration runner connects on `DIRECT_DATABASE_URL` (Story 11.4)
**When** migrations run in a deploy
**Then** they run on the direct string, once, before the new application version starts serving — and the deploy fails loudly and stops if any migration fails, leaving the previous version serving rather than a new version running against a half-migrated schema
**And** the migration step is **not** run by the application at boot: a container host that cold-starts several times a day would otherwise attempt migrations several times a day, and on a free tier's autosuspended database each attempt is a wake

**Given** a mistake that reaches the deployed database — a column of the wrong type, an index that should not have been created
**When** it is corrected
**Then** the correction is a **new numbered migration** taking the next open slot, never an edit to an already-applied migration file, and never a `down()` followed by a corrected `up()`
**And** an already-applied migration file is treated as immutable, so the local sequence and the deployed sequence cannot diverge — a repository whose migration 12 no longer matches the migration 12 that ran in production has no reliable way to reason about either

**Given** the numbered slots consumed by the time this epic ships — 01 through 22, with 23 the next open one and this epic consuming none
**When** the sequence is reviewed for the first hosted run
**Then** the migrations apply in their numbered order from 01 with no gaps and no reordering, `01-enable-btree-gist` first and alone as AD-20 requires, and the applied set on the host matches the repository's set exactly for every migration that exists at this point in the build
**And** the several slot reassignments recorded across Epics 6 through 10 — where the Requirements Inventory's prose described dependency order rather than reserving literal numbers — are confirmed to have produced one consistent sequence **so far**; this is **not** the last point at which that can be checked, since Epic 12 (re-sequenced to ship after this one, per Raviraj's decision) adds three more migrations — slots 23, 24, 25 — after this epic's first hosted run, and Epic 12's own implementation notes are where the fully-finished sequence, migrations 01 through 25, is confirmed consistent end to end

### Story 11.9: Prove AD-16 holds — no scheduler, no interval, no second process

As a developer,
I want an automated check that fails the build if a scheduler, a background worker, an interval driving domain logic, or a second process entry point ever enters the codebase,
So that the spec's hardest constraint is enforced by something that does not forget it (NFR4, AD-16, AD-19, AD-34).

**Acceptance Criteria:**

**Given** AD-16's rule that no scheduler, job queue, cron library or background worker "of any kind may enter `backend/package.json`", and its explicit statement that the named packages are "examples, not the definition, so a `croner` or a `toad-scheduler` is equally forbidden"
**When** the dependency check is written
**Then** it fails on the named examples — `node-cron`, `node-schedule`, `agenda`, `bull`, `bullmq`, `bree`, `cron` — **and** on any dependency name matching a pattern covering the category: `cron`, `schedul`, `queue`, `worker`, `job`, `agenda`, `bull`, `bree`, `rrule`, `timer`, `later`
**And** it checks **both `backend/package.json` and `frontend/package.json`**, including `devDependencies` — a scheduler in the frontend is a background loop hitting the API from a tab left open on the counter tablet, which is the same prohibited behaviour arriving through the other door
**And** a pattern match is a **build failure that requires a deliberate, reviewed exception**, not a warning — a category check that can be waved through is a category check that will be

**Given** the second way a scheduler arrives — as three lines in a service file rather than as a dependency
**When** the source check is written
**Then** **no `setInterval` appears anywhere in `backend/src/`**, with no exception; and **no self-rescheduling `setTimeout`** — a `setTimeout` whose callback schedules another `setTimeout` is a scheduler with a different name, and it is the specific shape AD-16 calls out
**And** in `frontend/src/`, `setTimeout` is permitted for exactly the two purposes that already exist — Story 5.1's AD-19.1 retry backoff, and UI debounce or transition timing — and is **forbidden from driving domain logic**: no timer recomputes an overdue status, refreshes a dashboard figure on a schedule, or re-issues a mutating gesture
**And** the check names the reason inline, because the person who adds the forbidden line will be looking at the check that stops them

**Given** AD-16's third clause — "no second entry point beyond `server.js` may appear in `backend/src/`"
**When** the process check is written
**Then** `backend/src/server.js` is the only file that binds a port or starts a process, and no `worker.js`, `consumer.js`, `scheduler.js` or equivalent exists
**And** `backend/package.json` declares exactly one start script, with no second `bin` entry and no second start target
**And** the check extends to **the host's own service configuration**, which is where a second process most plausibly arrives and where no `package.json` grep would ever see it: no `Procfile` declaring a second process type, no second service or worker declared in the container host's deployment configuration, and exactly one running service in the deployed project — a scheduler configured entirely in a hosting dashboard is still a scheduler, and it is the only variant of this violation that leaves no trace in the repository

**Given** AD-16's own explanation of *why* a job is tempting — that AD-34's deposit-exhaustion date is "a *date the system knows in advance*, and the reflex on seeing one is to schedule something for it"
**When** the three derived values are reviewed
**Then** all three are confirmed to be computed in the SELECT that renders the page and stored nowhere: overdue as `status = 'RENTED' AND (now() AT TIME ZONE 'Asia/Kolkata')::date > due_date`; maximum rental period as `floor(deposit_paise / overdue_per_day_paise)`; and the deposit-exhaustion date as `due_date + floor(deposit_paise / overdue_per_day_paise)` days
**And** none of the three has acquired a stored column, a cached value, or a "last computed at" timestamp anywhere in Epics 7, 8 or 9 — Story 8.4 created `rental_agreements.deposit_exhausted_on` as a **generated** column, which is the database deriving it on write from values on the same row, not a job computing it, and the check confirms it is still `GENERATED` rather than having become an ordinary column that something writes

**Given** the two legitimate things that look like violations and are not
**When** the check's exceptions are documented
**Then** both are named explicitly so nobody removes them in a cleanup: the **external uptime monitor** pinging `/api/health` (Story 11.3), which AD-16 exempts by name as "not code in this repo"; and the **external backup mechanism** (Story 11.2), which is outside the repository for the same reason
**And** both are recorded in the deployment document rather than in the codebase, because the exemption is precisely that they are not in the codebase

**Given** this story ships before Epic 12 (the owner dashboard, re-sequenced by this run to ship after this epic) adds its own reports module and question files
**When** the check first runs, across the codebase as it stands at the end of this epic
**Then** any violation it finds is **fixed here** rather than filed — and if it finds none, that result is recorded, because "AD-16 was verified against the build as it stood at the end of Epic 11" is a materially different statement from "AD-16 was never violated as far as anyone noticed"
**And** because this check is a repo-wide pattern match rather than an enumerated file list, it runs again automatically against every later commit, including Epic 12's — the check itself needs no update when Epic 12 ships; Epic 12's own implementation notes are where its result against the fully-finished build is worth recording once more, since that is the point at which "the complete build" finally means all twelve epics
