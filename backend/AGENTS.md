<!-- bmad:context -->
<!-- Verified 2026-08-19. No VCS in this repo yet (not a git repository) — re-verify against the initial commit SHA once one exists. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## Backend (IMPOC API)

Express 5 REST API on Sequelize/Postgres. JWT access+refresh auth with argon2 password hashing. Feature modules live under `src/modules/<name>/` (routes → controller → service, validated in `<name>.validation.js`).

## Policy

- Never commit `.env` — it holds real DB credentials, JWT secrets, and `SEED_ADMIN_PASSWORD`.
- Barcode PDF endpoints must require ADMIN or INVENTORY_MANAGER. `src/modules/barcode/barcode.routes.js` currently mounts `/generate` and `/test-sheet` with no auth middleware.

## Running and verifying

- Jest needs `NODE_OPTIONS=--experimental-vm-modules` (the package is ESM); a bare `jest` fails. Use the `npm test` scripts.
- Tests cover auth, users, roles, and permissions only. New modules have no suite until you write one.

## Conventions that differ from defaults

- Sequelize paths are non-default (`.sequelizerc`): migrations, seeders, and models live under `database/`, config is `config/config.js`, not `config/config.json`.
- Controllers parse input with a Zod schema from `<name>.validation.js`, then `next(error)`. `src/middleware/error.middleware.js` shapes every failure — never build error JSON in a controller.
- Responses are `{ success: true, data }` and `{ success: false, message, errors[] }`.
- Every table carries timestamps and a soft-delete column; never hard-delete a domain row.
- Add permissions as constants in `src/constants/permissions.js` and seed them; never string-literal a permission in a route. Roles are the five in `database/seeders/20260807175238-seed-roles.js`.
- Barcode PDFs use `bwip-js` and `pdfkit`. Do not add another barcode or PDF library.

<!-- /bmad:context -->
