# Deferred Work

Findings surfaced during build that are real but out of scope for the story that found them.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-enable-btree-gist-extension.md`
  summary: `npm test` destroys the development database — it runs `sequelize.sync({ force: true })` against `DB_NAME` because `DB_NAME_TEST` is defined nowhere.
  evidence: `backend/config/config.js` resolves the `test` environment to `process.env.DB_NAME_TEST || process.env.DB_NAME`, and `DB_NAME_TEST` appears in neither `.env` nor `.env.example`. `backend/tests/utils/test-setup.js:9` then calls `sync({ force: true })`, which drops and rebuilds every model table before seeding fixtures. Confirmed live on 2026-08-24: after a test run the dev database held one user and a leftover `TEST_ROLE_1787583531996` row in `roles`. `SequelizeMeta` and installed extensions survive, so migration state stays consistent while the data underneath it is replaced. This will silently destroy real data from Epic 3 onward.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-enable-btree-gist-extension.md`
  summary: The test harness builds its schema with `sync()`, not migrations, so no migration in the spine's 23-step order is covered by any automated check.
  evidence: `jest.config.js` `testMatch` is `**/tests/**/*.test.js`; grepping `backend/tests/` for `migrat`, `SequelizeMeta` and `umzug` returns nothing. `sync()` cannot generate a `CREATE EXTENSION`, a `SEQUENCE`, a generated `daterange` column, or an `EXCLUDE USING gist` constraint, so the test schema structurally diverges from the real one and Epic 7's overlap guard will be untestable there. Either move the harness onto `db:migrate` or accept the divergence explicitly before more migrations land.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-enable-btree-gist-extension.md`
  summary: Deployment prerequisites are absent from `config/config.js` and will make a hosted migration fail for reasons that look like the btree_gist gate but are not.
  evidence: All three environment blocks are byte-identical with no `dialectOptions.ssl`, while essentially every free-tier managed Postgres requires TLS — the failure would land at connect time, before `CREATE EXTENSION` is ever attempted. AD-19 also binds migrations to a direct (unpooled) connection and the app to a transaction-mode pooler, but only one `DB_HOST` is exposed. And `npm run db:migrate` is unpinned, silently using the `development` block unless `NODE_ENV` is exported. Belongs to Epic 11 (deployment and hosting).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-enable-btree-gist-extension.md`
  summary: Every migration in this repo is ESM and `backend/package.json` declares no `engines` floor, so a host on Node 18 or below Node 20.19 breaks the entire migration chain.
  evidence: sequelize-cli 6 loads migrations through umzug 2, which uses `require()`. `require()` of an ESM module only works on Node >= 20.19 / >= 22.12. Local development is Node 20.19.6 — one patch release above the cliff. On an older host the first migration dies with `ERR_REQUIRE_ESM`, which will read as the extension gate firing when it has not. Pre-existing: all six `20260807*` migrations have the same exposure. Pin `engines` before choosing a host.

- source_spec: `_bmad-output/implementation-artifacts/spec-gesture-type-constraint-sync.md`
  summary: Test for CHECK constraint self-heals when constraint missing, defeating the purpose of validating migrations were applied correctly.
  evidence: `request-keys-constraint.test.js` beforeAll hook checks if constraint exists; if not, it applies the correct 15-value constraint before tests run. This masks migration failures — if the migration were broken (e.g., only 14 values), the test would still pass by creating the correct constraint itself. Verification gap review (step-04) flagged this design. The test should either validate that migrations created the constraint (without self-healing) or split into two separate tests: one for migration correctness, one for constraint behavior. Refactor test to require pre-migrated schema or add dedicated migration validation test.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-create-unit-status-events-and-transition-unit.md`
  summary: Test coverage gaps for soft-delete filtering and channel-specific cause enforcement.
  evidence: Review found that getUnitByUuid, getUnitByBarcode, and getUnitStatusEvents filter soft-deleted rows, but no test verifies regression if the filter is removed. Similarly, the guard table enforces channel-specific cause restrictions (e.g., HAND_OVER only for RENTAL), but no test verifies that a mismatched channel is rejected. Pagination test also uses uncommitted transaction data. These are verification gaps, not broken code.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-create-unit-status-events-and-transition-unit.md`
  summary: Missing database indexes for performance optimization.
  evidence: unit_status_events has indexes on unit_id alone and created_at alone, but the common query pattern fetches by unit_id ordered by created_at DESC — a composite index would be more efficient. Also, no index on cause field for audit queries filtering by transition type (e.g., "all RECOVERY events"). Not blocking functionality but should be addressed in a separate optimization story.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-create-unit-status-events-and-transition-unit.md`
  summary: Gesture audit records not logged by transitionUnit() itself.
  evidence: Story 4.1 defines UNIT_TRANSITION and UNIT_RECOVER gesture types but does not create request_keys records for transitions. This is by design — Story 4.2/4.3/4.4 call transitionUnit() inside transactions where they handle idempotency. This is not a gap in Story 4.1 but a noted dependency for the follow-on stories.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-vendor-registry.md`
  summary: Pagination missing from vendor list endpoint — production systems need pagination to avoid loading entire vendor tables into memory
  evidence: `vendor.service.js` `getVendors()` returns all vendors; no pagination parameters, limits, or offset support. Future stories depending on vendors API will likely need pagination. Add as enhancement: limit, offset, and metadata (total count, hasMore) in response.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-vendor-registry.md`
  summary: Search and filter functionality missing from vendor list — clients cannot query vendors by name or phone
  evidence: `getVendors()` returns all vendors ordered only by createdAt, with no ability to filter by name, phone, or active status. When vendor count grows, listing becomes inefficient. Add as enhancement: name/phone search and status filters.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-vendor-registry.md`
  summary: Email field missing from vendor model — vendors typically require email addresses for communication
  evidence: Spec intentionally omits email per FR4/CAP-4 requirements ("phone, address, notes"). If email becomes required, add to schema and Epic 2 retrospective decision log. Not a gap; recorded for future reference if requirements change.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-vendor-registry.md`
  summary: Vendor categorization field missing — real-world vendors often need classification (supplier, manufacturer, distributor)
  evidence: Spec omits vendor type/category per scope boundary: "vendor CRUD only." If categorization becomes needed (e.g., for intake picker filtering in Epic 3), add as separate story. Deferred to Epic 3 inventory enhancement.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-vendor-registry.md`
  summary: Audit logging absent — no tracking of who created/modified vendors or when changes occurred
  evidence: No created_by, modified_by, or audit table. Compliance and debugging require audit trails. Belongs to Epic 10 (consent and erasure) or a dedicated audit-logging story. Out of scope for vendor CRUD; required for production compliance.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-vendor-registry.md`
  summary: Soft-delete endpoint missing — no explicit DELETE route, only PATCH to deactivate
  evidence: Spec intentionally uses deactivation (isActive: false) as the vendor removal mechanism; soft-delete (deleted_at) exists for schema uniformity but is not exposed. If hard deletion is needed (e.g., admin purge), add as separate permission-gated endpoint in Epic 11 admin panel.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-vendor-registry.md`
  summary: Phone format validation missing — no regex or pattern enforcement for phone numbers
  evidence: Phone field accepts any string up to 20 chars, including non-numeric values and emoji. If phone validation is needed (e.g., for WhatsApp integration in Epic 6), add pattern validation. Low priority; international phone numbers vary widely in format.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-vendor-registry.md`
  summary: Soft-delete vs deactivation semantics could be clarified in documentation
  evidence: Schema supports both deleted_at (soft-delete) and is_active (deactivation), but their intended interaction is not documented. Added to Code Map; document in API reference or Epic 2 retrospective notes for clarity in Epic 3.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-enable-btree-gist-extension.md`
  summary: `CREATE EXTENSION` does not pin a schema, and the local/target Postgres versions are unpinned and already diverge.
  evidence: `CREATE EXTENSION IF NOT EXISTS btree_gist` installs into the first schema on `search_path` (`"$user", public`). Locally that resolved to `public`, but a provider that sequesters extensions in a dedicated schema could leave the gist operator classes unresolvable when Epic 7 issues its `EXCLUDE USING gist`. Adding `WITH SCHEMA public` is still one statement and would pin it — but on a provider that forbids `public`, pinning is itself the failure. The right time to decide is when the host is chosen, not blind. Related: development is PostgreSQL 18.0 with btree_gist 1.8 while the target is 15+, which ships 1.5–1.7, and nothing asserts a minimum major version.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-enable-btree-gist-extension.md`
  summary: `backend/DB_RESET_GUIDE.md` and `.env.example` do not record that the migrating role now needs `CREATE EXTENSION` privilege.
  evidence: The guide walks the full reset flow and lists every migration command but never mentions the extension, the privilege it requires, or that `db:migrate:undo:all` — used by both `db:refresh` and `scripts/db-reset.sh` — now drops it on every routine local reset. The migrating role is therefore privileged differently from the app runtime role, and nothing in the repo says so. Most likely thing to be forgotten at deploy time.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-create-barcode-seq-sequence.md`
  summary: Jest test suite does not run migrations and will not see barcode_seq when Story 1.6 first calls nextval.
  evidence: backend/tests/utils/test-setup.js:9 builds schema with sync({ force: true }), never calling db:migrate. This story adds infrastructure only; Story 1.6 will surface the gap when a test barcode-generation route tries to read the sequence and gets "relation does not exist".

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-create-barcode-seq-sequence.md`
  summary: barcode.service.js has existing bugs in the current Date.now() generator that Story 1.6 will replace.
  evidence: generateBarcodeValues uses one Date.now() per request (not per-request collision as description claimed), and String(index + 1).padStart(3, '0') overflows to four digits past 999, emitting mixed-length barcodes on a 100-page sheet. Story 1.6 owns both the generator replacement and fixing these.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-create-barcode-seq-sequence.md`
  summary: Barcode endpoints remain unauthenticated; any caller can burn 2400 values per request once Story 1.6 reads the sequence.
  evidence: backend/src/modules/barcode/barcode.routes.js mounts /generate with no auth middleware. Already noted in backend/AGENTS.md as Story 1.7 (Authenticate and authorize barcode routes). Non-recyclable resource abuse is only exposed once the sequence is readable.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-create-the-app_settings-table-and-typed-accessor.md`
  summary: app-settings service lacks write operations (set/update/delete); table is read-only from accessor perspective.
  evidence: app-settings.service.js exports only `get(key)`. The spec explicitly states "only get() is needed now" and "no CRUD methods in this story". Later stories that need write access (Story 1.5 for seeding geometry, future admin settings flows) will add set/update/delete methods when their scope requires them. Deferring prevents over-engineering the module before its write-path requirements are clear.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-create-the-app_settings-table-and-typed-accessor.md`
  summary: app_settings table has no seed rows; initial geometry values (barcode width, height, text size, margins, clear space) must be seeded by Story 1.5.
  evidence: Story 1.3 is the foundation infrastructure story (table and accessor only). Story 1.5 (Rework barcode label layout) is the first consumer and owns seeding the geometry keys into app_settings. The dependency is explicit in both spec files.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-create-the-app_settings-table-and-typed-accessor.md`
  summary: CHECK constraint for value_type uses Sequelize.Op.in syntax, which may not be portable across SQLite/MySQL/PostgreSQL without dialect-specific SQL generation.
  evidence: The project targets PostgreSQL (AD-19, AD-20) and the constraint works correctly on the development environment (PostgreSQL 18). However, if a future sprint extends support to other databases, the constraint syntax may require dialect-specific handling. This is an architectural decision (Postgres-only) rather than a bug. Belongs to Epic 11 (deployment/hosting) when multi-database support is considered, if ever.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-create-the-app_settings-table-and-typed-accessor.md`
  summary: app_settings table lacks metadata or description column; no way to document the purpose or valid values for each setting.
  evidence: Settings like 'barcode_page_width' are self-documenting, but future settings may not be obvious. A `description TEXT` column and a documentation/comments pattern would help maintainability. Deferred to the first story that needs to expose admin UI for settings management (future epic).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-create-the-app_settings-table-and-typed-accessor.md`
  summary: Migration down() does not use CASCADE for foreign key cleanup; will fail if other tables later add foreign keys to app_settings.
  evidence: Currently no foreign keys reference app_settings, so down() cleanly drops the table. If a future story adds a FK constraint from another table, down() will fail with "cannot drop table app_settings because other objects depend on it" unless the constraint is dropped first. This is deferred because no FK exists yet and the migration order (app_settings is created early) makes FKs unlikely. If FKs are added later, the migration will need explicit constraint-drop logic in its down() function.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-create-request-keys-table-and-idempotency-helper.md`
  summary: No TTL or retention policy defined for request_keys entries; table will grow unbounded over time.
  evidence: The spec requires entries to persist for client replay under AD-19 (cold-start retry), but does not define how long. Typical idempotency windows are 24–48 hours. Without a cleanup job or TTL, the table will accumulate millions of rows, degrading lookup performance and consuming storage. This belongs to Epic 11 (deployment/hosting) or to an operational story that defines retention policy and implements cleanup.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-create-request-keys-table-and-idempotency-helper.md`
  summary: Gesture-type constants and gesture_type CHECK constraint may diverge during deployment; adding a new gesture type requires coordinated schema + code update.
  evidence: All 14 gesture types are enumerated in `backend/src/constants/gesture-type.js` as application constants, and the migration creates a CHECK constraint listing the same 14 values. If a future epic adds a new gesture type (GESTURE_TYPE_N), the developer must update both files and ensure both changes deploy atomically. If the constant is added but the constraint not updated (or vice versa), validation will silently reject valid requests. A future story should add a deployment guard (e.g., a runtime check comparing constants against database constraint definition, or a pre-deployment audit script) to catch mismatches.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-create-request-keys-table-and-idempotency-helper.md`
  summary: Index strategy incomplete; missing index on request_uuid alone and on (request_uuid, deleted_at) for efficient replay lookups.
  evidence: The partial unique index on (gesture_type, request_uuid) WHERE deleted_at IS NULL is correct for uniqueness, but lookup queries always filter by gesture_type first. If a future story queries by request_uuid alone (e.g., audit or recovery operations), the index will not cover it and scans will be slow. Add a second index on request_uuid (or request_uuid, deleted_at) when the query pattern is clear. This belongs to a future performance-tuning story.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-create-request-keys-table-and-idempotency-helper.md`
  summary: Transaction isolation level not specified; concurrent requests may see inconsistent replay state under weaker isolation levels.
  evidence: The barcode service wraps generation in `sequelize.transaction()` with no explicit isolation level, defaulting to the database/connection's default (likely READ_COMMITTED). Under weaker isolation, two concurrent identical requests could both pass the lookup check before either inserts, bypassing the partial unique index guard. The spec states exactly-one-commits is guaranteed by the index, but isolation level matters. This should be verified in Epic 11 (hosting/deployment) when the target database platform is chosen; isolation level is often a configuration parameter, not a code change.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-create-request-keys-table-and-idempotency-helper.md`
  summary: Permission-to-gesture mapping strategy is undocumented; only BARCODE_GENERATE is gated now, but 13 remaining gesture types have no permission strategy defined.
  evidence: The BARCODE_GENERATE permission is correctly applied to `/generate` and `/test-sheet` routes. However, future stories will implement SALE_CHECKOUT, RENTAL_BOOK, EXPENSE_CREATE, etc., each with their own permission requirements (e.g., SALES.CHECKOUT vs. RENTALS.BOOK). No story has documented whether each gesture will have its own permission constant, or whether multiple gestures share one permission, or how permission-to-gesture mapping is decided. This decision should be made in the epic planning phase before implementing Story 5.1 or later, to avoid inconsistent permission strategies across the codebase.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-create-request-keys-table-and-idempotency-helper.md`
  summary: Seeder migration is not idempotent; re-running migrations will fail if BARCODE_GENERATE permission already exists.
  evidence: The seed migration (`20260825000005-seed-barcode-permission.js`) inserts a new permission row without checking for existence. In deployment scenarios where migrations are re-run (e.g., rollback + forward, or CI scripts re-running migration chains), the second insert will fail on the unique constraint over the permission value. The migration should use `findOrCreate` or include an `IF NOT EXISTS` check (PostgreSQL) before insert. This is a minor issue because seeder migrations typically run once, but belongs to Epic 11 (deployment/hosting) for hardening the migration chain.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-colour-and-size-picklists.md`
  summary: GET /api/picklists/colours and /api/picklists/sizes endpoints lack pagination support for large datasets.
  evidence: Both list endpoints return all non-deleted records with no limit, offset, or cursor-based pagination. As the colour and size catalogs grow to hundreds or thousands of entries, unbounded list responses will consume excessive memory and timeout. Implement pagination (limit/offset or cursor-based) as a separate story when scale becomes a concern or when admin UI needs to display large picklists.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-colour-and-size-picklists.md`
  summary: No cascading behavior or foreign key constraints defined for colours and sizes tables used in later epics.
  evidence: The spec creates `colours` and `sizes` as standalone reference data. Later epics (Epic 3 stock intake, Epic 5 sales checkout, etc.) will reference these tables via `color_id`/`size_id` foreign keys. The spec does not address what happens when a colour or size is deactivated while in-use, or whether cascading deletes are prevented. These referential integrity rules belong to the stories that first add foreign keys (Epic 3 and later) and should be documented then.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-colour-and-size-picklists.md`
  summary: List endpoints lack query parameters for filtering (e.g., ?isActive=true) and sorting (e.g., ?sortBy=name).
  evidence: The spec defines only basic GET /all endpoint returning all records. Admin UI or intake forms may need to filter to active colours only or sort by name alphabetically. Add query parameter support for filtering and sorting in a future story when the UI requirements clarify. Current MVP supports full listing only.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-colour-and-size-picklists.md`
  summary: OpenAPI/Swagger documentation is not generated or linked for the new picklist endpoints.
  evidence: The API is implemented but no OpenAPI spec, documentation URL, or developer guide references the new /api/picklists/colours and /api/picklists/sizes endpoints. Integrate into centralized API documentation when a documentation system is chosen (Epic 11 or future).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-colour-and-size-picklists.md`
  summary: Rate limiting is not specified or enforced on picklist endpoints, especially POST (create) which is write-heavy.
  evidence: No mention of rate limits on any colour/size endpoint. If staff spam create requests or malicious actors discover the unauthenticated schema, write amplification is possible. Implement rate limiting (per-user, per-IP, or global) in a future infrastructure or security hardening story (likely Epic 11).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-colour-and-size-picklists.md`
  summary: No bulk create, bulk update, or batch delete endpoints; all operations are single-record.
  evidence: CRUD endpoints handle one colour or size at a time. If staff need to ingest 100 new colours from a supplier or bulk-deactivate seasonal sizes, the API requires 100 sequential requests. A bulk-operations endpoint or batch-upsert pattern would improve performance. Defer to a future story when bulk-import requirements are clear (likely later in Epic 2 or Epic 3 intake workflows).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-colour-and-size-picklists.md`
  summary: Error logging, monitoring, and audit trail are not configured for picklist changes.
  evidence: All CRUD operations log errors via middleware only. No application-level logging of who created/updated/deactivated colours and sizes, when, or why. For audit compliance and debugging, capture these events in an audit table or structured log. This belongs to a future observability or compliance story (likely Epic 11).

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-vendor-detail-trip-lot-and-unit-history.md`
  summary: Pagination not implemented for vendor history endpoint — large datasets return entirely on every request.
  evidence: GET /api/vendors/:uuid/history returns all trips/lots/units without limit or offset parameters. When a vendor has thousands of transactions, response size could be problematic. Add pagination (limit/offset or cursor) when scale requires it or API design standards mandate it.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-vendor-detail-trip-lot-and-unit-history.md`
  summary: Caching strategy missing for vendor history endpoint — read-only, frequently-accessed data.
  evidence: Every request executes full nested eager-load query over trips/lots/units. No mention of HTTP caching headers, Redis caching, or response memoization. Add caching when performance requirements clarify or if cache invalidation rules can be defined (e.g., clear on trip/lot/unit writes).

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-vendor-detail-trip-lot-and-unit-history.md`
  summary: Database indexes not optimized — no index on StockIntake.purchasedOn for trip sort performance.
  evidence: Query sorts trips by purchasedOn DESC. Large trip tables (100k+ rows) may benefit from a partial index on purchasedOn WHERE deletedAt IS NULL. Profile once history endpoint is in production and add index if query is slow.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-vendor-detail-trip-lot-and-unit-history.md`
  summary: API documentation/schema missing — no OpenAPI spec or response examples documented.
  evidence: Endpoint works but is not documented in Swagger/OpenAPI. Add endpoint documentation when API docs are centralized (belongs to Epic 11 or future DevOps work).

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-vendor-detail-trip-lot-and-unit-history.md`
  summary: No audit logging for sensitive vendor transaction history access.
  evidence: No logging of who accessed vendor history or when. Compliance may require audit trail for transaction data access. Add when audit logging system is established (likely Epic 10 or 11).

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-vendor-detail-trip-lot-and-unit-history.md`
  summary: Soft-delete behavior for vendor itself not specified — should history be accessible if vendor is deleted?
  evidence: Spec filters soft-deleted trips/lots/units but does not define whether history should be visible if the Vendor row itself is soft-deleted. Current implementation only returns vendors that exist (not soft-deleted). Clarify if deactivated vendors should hide history or if only the vendor row is hidden but history remains.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-vendor-detail-trip-lot-and-unit-history.md`
  summary: No concurrent modification safeguards — isolation level and consistency not specified.
  evidence: Read-only endpoint has no explicit transaction isolation level. If data changes during nested query (e.g., trip deleted between vendor fetch and StockIntake query), results could be inconsistent. Verify default isolation level is acceptable or add explicit transaction() wrapper if strong consistency needed.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-vendor-detail-trip-lot-and-unit-history.md`
  summary: Date-range filtering not available — no way to retrieve history for a specific period.
  evidence: Endpoint returns all trips regardless of date. Query parameters for purchasedOn range (e.g., ?fromDate=2026-08-01&toDate=2026-08-31) could improve usability. Add when filtering requirements clarify.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-6-vendor-detail-trip-lot-and-unit-history.md`
  summary: No bulk/batch endpoint for retrieving history of multiple vendors.
  evidence: Only single-vendor history available (GET /api/vendors/:uuid/history). If staff need to compare multiple vendors' history, they must make N separate requests. Add batch endpoint (e.g., POST /api/vendors/history with array of UUIDs) when use case is identified.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-12-expose-permissions-on-login.md`
  summary: API documentation and OpenAPI/schema updates needed to reflect permissions field in auth responses.
  evidence: /auth/login and GET /auth/me response schemas now include permissions array, but no OpenAPI spec or API documentation has been updated to reflect this. Frontend developers relying on API docs will not see the new field. Add OpenAPI schema updates and docs as a separate infrastructure story.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-12-expose-permissions-on-login.md`
  summary: Performance consideration: calling getUserPermissions() on every login and every session restore could benefit from caching strategy.
  evidence: Current implementation calls getUserPermissions() fresh on each login and GET /auth/me call. If permission changes are infrequent but users log in frequently, consider caching user permissions with an expiration TTL or cache invalidation on role/permission changes. Not a correctness issue; deferred to performance optimization review when metrics suggest it's needed.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-12-expose-permissions-on-login.md`
  summary: Permission matrix documentation and canonical list needed.
  evidence: Implementation correctly wires getUserPermissions() into responses, but there's no centralized documentation of all valid permission codes, which roles hold which permissions, or how new permissions should be added when future epics land. Create a permissions.md documentation file in backend/docs or backend/ARCHITECTURE.md section for future maintainers.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-barcode-gesture-type-split.md`
  summary: Missing authorization/authentication tests for barcode endpoints.
  evidence: Tests in barcode.integration.test.js do not verify that missing, invalid, or expired Bearer tokens are properly rejected. Add test coverage for missing Authorization header, malformed token format, and expired tokens to verify endpoints properly enforce auth requirements.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-barcode-gesture-type-split.md`
  summary: Missing cross-user access validation tests for barcode endpoints.
  evidence: No test verifies that a user cannot retrieve another user's cached PDF via requestUuid if the actor_user_id differs. Add test case to ensure idempotency cache is scoped to the requesting user.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-barcode-gesture-type-split.md`
  summary: Missing invalid requestUuid format validation tests.
  evidence: While basic validation tests exist for /generate, /test-sheet lacks explicit validation tests for malformed requestUuid (empty string, non-UUID format, null). Add validation test cases for /test-sheet endpoint.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-barcode-gesture-type-split.md`
  summary: Missing PDF generation failure handling tests.
  evidence: No test scenario verifies behavior when PDF generation fails or throws an error (e.g., geometry settings missing, bwip-js failure). Add error path test to ensure graceful error response instead of server crash.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-barcode-gesture-type-split.md`
  summary: Missing comprehensive request_keys record verification.
  evidence: Tests verify some RequestKey fields but not all (gesture_type, result_kind, actor_user_id, timestamps). Add complete record verification to catch silent field regressions.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-barcode-gesture-type-split.md`
  summary: Missing performance/timeout tests for barcode endpoints.
  evidence: No validation that endpoints respond within acceptable time limits, especially for large PDF generation (multiple pages). Add performance regression test or timeout guard.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-barcode-gesture-type-split.md`
  summary: Test documentation missing rationale for BARCODE_GENERATE_TEST gesture type choice.
  evidence: Comments in barcode.integration.test.js do not explain why BARCODE_GENERATE_TEST is the correct gesture type or reference Story/AD requirements. Add documentation to prevent future confusion if gesture types are refactored.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-barcode-gesture-type-split.md`
  summary: Missing cleanup verification for test data persistence.
  evidence: No assertion verifies that temporary RequestKey records don't persist after test completion or that deleted_at is properly managed. Add test cleanup verification.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-doubled-api-prefix.md`
  summary: No type safety on route definitions — TypeScript types or JSDoc annotations would catch typos at development time.
  evidence: frontend/src/platform/routes.js lacks type annotations. Typos in route paths would only be caught at runtime or by manual testing. Add TypeScript or JSDoc types to enforce path shape and prevent future typos.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-doubled-api-prefix.md`
  summary: Incomplete endpoint migration — only barcode and stock intake routes were centralized; other API calls throughout codebase still use hardcoded paths.
  evidence: Grep of codebase shows only these two services migrated. Other screens/services likely make apiClient calls with hardcoded paths. Complete the migration as new screens are added or audit existing screens for path consistency.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-doubled-api-prefix.md`
  summary: Missing related endpoints — routes file only covers GET /barcodes/generate and POST /stock-intake-lines/{uuid}/scan.
  evidence: If barcode and stock intake features grow to include delete, update, or list endpoints, they should be added to routes.js. As new endpoints are needed, add to centralized file following the established pattern.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-doubled-api-prefix.md`
  summary: No API response documentation — routes are defined but lack comments describing return types, error codes, or required parameters.
  evidence: BARCODE_ROUTES and STOCK_INTAKE_ROUTES have minimal JSDoc. Consumers reading the routes file may not understand what each endpoint returns or what errors are possible. Enhance JSDoc with response type and error documentation.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-doubled-api-prefix.md`
  summary: Missing environment-specific configuration — routes file assumes single API base URL with no support for different endpoints per environment.
  evidence: BARCODE_ROUTES and STOCK_INTAKE_ROUTES are hardcoded. If dev/staging/prod need different endpoint URLs or if endpoints are versioned (e.g., /v1/barcodes), the routes file would need environment checks or configuration injection. Defer to infrastructure story if multi-environment support is needed.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-doubled-api-prefix.md`
  summary: barcodeApi.js module is unused — no files import or call the scan() function.
  evidence: Grep found no references to barcodeApi.scan() in the frontend codebase. Changes to this module have no effect on the running app. Either integrate scan() into a component/screen or remove as dead code if it's not planned.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-doubled-api-prefix.md`
  summary: Missing route validation mechanism — no test or utility verifies that all referenced routes exist on the backend or match API specification.
  evidence: Routes are defined in routes.js but there's no automated check that the backend actually exposes these endpoints or that their shapes haven't changed. Consider adding a contract-testing or OpenAPI schema validation step in CI when API versioning becomes important.
